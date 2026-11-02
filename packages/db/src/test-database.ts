import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import {
  TEST_RUN_DATABASE_MARKER,
  getTestEnvironment,
  getTestRunEnvironment,
} from "./test-environment";

/**
 * Each run tests on its own copy of the migrated test database, so rows an earlier run left never
 * change a later one. Tests never connect to the template, since Postgres copies a database only
 * while nothing else is connected to it.
 */

const MAINTENANCE_DATABASE = "postgres";
const OBJECT_IN_USE = "55006";
const UNDEFINED_TABLE = "42P01";
const MIGRATIONS_DIRECTORY = resolve(import.meta.dirname, "prisma/migrations");

function getDatabaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

function withDatabase({ name, url }: { name: string; url: string }): string {
  const next = new URL(url);
  next.pathname = `/${encodeURIComponent(name)}`;
  return next.toString();
}

function getErrorCode(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

async function withClient<T>({
  run,
  url,
}: {
  run: (client: Client) => Promise<T>;
  url: string;
}): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function dropStatement({ client, name }: { client: Client; name: string }): string {
  return `DROP DATABASE IF EXISTS ${client.escapeIdentifier(name)} WITH (FORCE)`;
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return getErrorCode(error) === "EPERM";
  }
}

function isAbandoned({ name, prefix }: { name: string; prefix: string }): boolean {
  const pid = Number(name.slice(prefix.length));
  return Number.isInteger(pid) && (pid === process.pid || !isRunning(pid));
}

async function dropAbandonedCopies({
  client,
  template,
}: {
  client: Client;
  template: string;
}): Promise<void> {
  const prefix = `${template}${TEST_RUN_DATABASE_MARKER}`;

  const { rows } = await client.query<{ datname: string }>(
    "SELECT datname FROM pg_database WHERE starts_with(datname, $1)",
    [prefix],
  );

  const abandoned = rows.map((row) => row.datname).filter((name) => isAbandoned({ name, prefix }));

  // One connection runs its statements one at a time, in order.
  await Promise.all(abandoned.map((name) => client.query(dropStatement({ client, name }))));
}

async function copyTemplate({
  client,
  name,
  template,
}: {
  client: Client;
  name: string;
  template: string;
}): Promise<void> {
  try {
    await client.query(
      `CREATE DATABASE ${client.escapeIdentifier(name)} TEMPLATE ${client.escapeIdentifier(template)}`,
    );
  } catch (error) {
    if (getErrorCode(error) !== OBJECT_IN_USE) {
      throw error;
    }

    throw new Error(
      `Something is connected to the test database ${template}, so this run can't copy it. Close the connection (a database tool, or a test run from before runs had their own copy) and run again.`,
      { cause: error },
    );
  }
}

function readMigrationChecksums(): Map<string, string> {
  const folders = readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );

  return new Map(
    folders.map((folder) => [
      folder.name,
      createHash("sha256")
        .update(readFileSync(resolve(MIGRATIONS_DIRECTORY, folder.name, "migration.sql")))
        .digest("hex"),
    ]),
  );
}

async function readAppliedMigrations(url: string): Promise<Map<string, string>> {
  try {
    return await withClient({
      run: async (client) => {
        const { rows } = await client.query<{ checksum: string; migration_name: string }>(
          "SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
        );

        return new Map(rows.map((row) => [row.migration_name, row.checksum]));
      },
      url,
    });
  } catch (error) {
    if (getErrorCode(error) === UNDEFINED_TABLE) {
      return new Map();
    }

    throw error;
  }
}

async function findMigrationDrift(url: string): Promise<string[]> {
  const applied = await readAppliedMigrations(url);
  const expected = [...readMigrationChecksums()];

  return [
    ...expected
      .filter(([migration]) => !applied.has(migration))
      .map(([migration]) => `${migration} isn't applied`),
    ...expected
      .filter(
        ([migration, checksum]) => applied.has(migration) && applied.get(migration) !== checksum,
      )
      .map(([migration]) => `${migration} changed after it was applied`),
    ...[...applied.keys()]
      .filter((migration) => !expected.some(([name]) => name === migration))
      .map((migration) => `${migration} is applied but not in the repository`),
  ];
}

/** An interrupted run ends through `process.exit`, where only synchronous work still runs. */
function dropOnExit({ name, serverUrl }: { name: string; serverUrl: string }): void {
  const script = `
    const { Client } = (await import(process.env.TEST_DATABASE_PG)).default;
    const client = new Client({ connectionString: process.env.TEST_DATABASE_SERVER });
    await client.connect();
    await client.query(\`DROP DATABASE IF EXISTS \${client.escapeIdentifier(process.env.TEST_DATABASE_COPY)} WITH (FORCE)\`);
    await client.end();`;

  spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    env: {
      ...process.env,
      TEST_DATABASE_COPY: name,
      TEST_DATABASE_PG: pathToFileURL(createRequire(import.meta.url).resolve("pg")).href,
      TEST_DATABASE_SERVER: serverUrl,
    },
    stdio: "ignore",
    timeout: 10_000,
  });
}

/** Refuses a copy whose migrations differ from the repository's: tests never use an old schema. */
export default async function setupTestDatabase(): Promise<() => Promise<void>> {
  const templateUrl = getTestEnvironment("test").DATABASE_URL_UNPOOLED ?? "";
  const copyUrl = getTestRunEnvironment().DATABASE_URL_UNPOOLED ?? "";
  const template = getDatabaseName(templateUrl);
  const name = getDatabaseName(copyUrl);
  const serverUrl = withDatabase({ name: MAINTENANCE_DATABASE, url: templateUrl });

  const drop = () =>
    withClient({
      run: async (client) => {
        await client.query(dropStatement({ client, name }));
      },
      url: serverUrl,
    });

  await withClient({
    run: async (client) => {
      await dropAbandonedCopies({ client, template });
      await copyTemplate({ client, name, template });
    },
    url: serverUrl,
  });

  const onExit = () => dropOnExit({ name, serverUrl });
  process.once("exit", onExit);

  const teardown = async () => {
    process.off("exit", onExit);
    await drop();
  };

  const drift = await findMigrationDrift(copyUrl);

  if (drift.length > 0) {
    await teardown();

    throw new Error(
      `The test database ${template} doesn't match prisma/migrations: ${drift.join("; ")}. Run \`pnpm --filter @zoonk/db db:setup:test\` to apply new migrations. After editing a migration in place, apply the change and its new checksum to ${template} too.`,
    );
  }

  return teardown;
}
