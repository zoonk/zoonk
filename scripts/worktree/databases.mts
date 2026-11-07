import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DatabaseMode, ownDevelopmentDatabaseUrl } from "./environment.mts";
import {
  postgresEnvironment,
  query,
  run,
  sqlLiteral,
  together,
  withDatabaseLock,
} from "./postgres.mts";

/** A fresh database is marked ready only once it's migrated and has its content. */
export type CheckoutDatabase = { fresh: boolean; mode: DatabaseMode; seed: boolean; url: URL };

export function prisma({
  args,
  env = process.env,
  worktree,
}: {
  args: string[];
  env?: NodeJS.ProcessEnv;
  worktree: string;
}): Promise<string> {
  const directory = join(worktree, "packages/db");
  const cli = createRequire(join(directory, "package.json")).resolve("prisma/build/index.js");
  return run({ args: [cli, ...args], command: process.execPath, cwd: directory, env });
}

function runDatabaseScript({
  env,
  script,
  worktree,
}: {
  env: NodeJS.ProcessEnv;
  script: string;
  worktree: string;
}): Promise<string> {
  const directory = join(worktree, "packages/db");

  return run({
    args: [createRequire(join(directory, "package.json")).resolve("tsx/cli"), script],
    command: process.execPath,
    cwd: directory,
    env,
  });
}

/**
 * A migration can retire stored lessons, the seed's hand-written ones too, so a development
 * database that keeps its rows gets the seed's Library again after its migrations.
 */
function seedLibrary({ env, worktree }: { env: NodeJS.ProcessEnv; worktree: string }) {
  return runDatabaseScript({ env, script: "src/prisma/seed-library.ts", worktree });
}

/**
 * Does nothing unless the checkout uses this worktree's own copy, so the primary checkout's `zoonk`
 * is never migrated. Setup and other starts in the checkout write the same rows, so it takes setup's
 * lock.
 */
export async function updateDevelopmentDatabase(worktree: string): Promise<void> {
  const url = ownDevelopmentDatabaseUrl(worktree);

  if (!url) {
    return;
  }

  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url };

  await withDatabaseLock({
    action: async () => {
      await prisma({ args: ["migrate", "deploy"], env, worktree });
      await seedLibrary({ env, worktree });
    },
    source: new URL(url),
    worktree,
  });
}

export function databaseName(database: CheckoutDatabase): string {
  return decodeURIComponent(database.url.pathname.slice(1));
}

function urlEnvironment(database: CheckoutDatabase): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: database.url.href,
    DATABASE_URL_UNPOOLED: database.url.href,
  };
}

/** Each database is managed on its own server; `source` names the primary checkout's database for cleanup. */
export function markDatabase({
  database,
  ready,
  source,
  worktree,
}: {
  database: CheckoutDatabase;
  ready: boolean;
  source: URL;
  worktree: string;
}): Promise<string> {
  const metadata = JSON.stringify({
    observedAt: Date.now(),
    owner: "zoonk-worktree-v1",
    ready,
    source: source.pathname,
    worktree,
  });

  return query({
    source: database.url,
    sql: `COMMENT ON DATABASE "${databaseName(database)}" IS ${sqlLiteral(metadata)}`,
  });
}

/**
 * A database this checkout's setup didn't create is never replaced: a worktree refuses one with its
 * copy's name, and the primary checkout keeps its own.
 */
async function prepareDatabase({
  database,
  isolated,
  source,
  worktree,
}: {
  database: CheckoutDatabase;
  isolated: boolean;
  source: URL;
  worktree: string;
}): Promise<CheckoutDatabase> {
  const name = databaseName(database);

  const state = await query({
    source: database.url,
    sql: `SELECT CASE
      WHEN shobj_description(oid, 'pg_database') IS JSON OBJECT THEN
        CASE WHEN shobj_description(oid, 'pg_database')::jsonb->>'owner' = 'zoonk-worktree-v1'
          AND shobj_description(oid, 'pg_database')::jsonb->>'worktree' = ${sqlLiteral(worktree)}
        THEN shobj_description(oid, 'pg_database')::jsonb->>'ready' ELSE 'unmanaged' END
      ELSE 'unmanaged' END FROM pg_database WHERE datname = ${sqlLiteral(name)}`,
  });

  if (state === "true") {
    // A fresh mark keeps a cleanup that found this worktree missing from dropping its copies.
    await markDatabase({ database, ready: true, source, worktree });
    return database;
  }

  if (state && state !== "false") {
    if (isolated) {
      throw new Error(`Refusing to replace unmanaged database ${name}.`);
    }

    return database;
  }

  // Only unfinished databases from this checkout's previous setup may be rebuilt. Never force a
  // disconnect.
  if (state === "false") {
    await query({ source: database.url, sql: `DROP DATABASE "${name}"` });
  }

  await query({ source: database.url, sql: `CREATE DATABASE "${name}" TEMPLATE template0` });
  await markDatabase({ database, ready: false, source, worktree });
  return { ...database, fresh: true, seed: true };
}

async function hasSourceDatabase(source: URL): Promise<boolean> {
  const name = sqlLiteral(decodeURIComponent(source.pathname.slice(1)));
  return Boolean(await query({ source, sql: `SELECT 1 FROM pg_database WHERE datname = ${name}` }));
}

async function copySourceDatabase({
  database,
  source,
}: {
  database: CheckoutDatabase;
  source: URL;
}): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "zoonk-worktree-"));
  const archive = join(directory, "development.dump");
  const env = postgresEnvironment(source);

  try {
    // A logical snapshot works while the primary checkout has open connections.
    await run({
      args: [
        "-w",
        "-d",
        decodeURIComponent(source.pathname.slice(1)),
        "-Fc",
        "-Z0",
        "--no-owner",
        "--no-acl",
        "--lock-wait-timeout=2s",
        "-f",
        archive,
      ],
      command: "pg_dump",
      env,
    });

    await run({
      args: [
        "-w",
        "-d",
        databaseName(database),
        "--no-owner",
        "--no-acl",
        "--exit-on-error",
        "--single-transaction",
        archive,
      ],
      command: "pg_restore",
      env: postgresEnvironment(database.url),
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

/** A worktree's development copy starts as the primary checkout's `zoonk` when there is one; every other fresh database is seeded. */
export async function prepareDatabases({
  isolated,
  source,
  urls,
  worktree,
}: {
  isolated: boolean;
  source: URL;
  urls: Record<DatabaseMode, URL>;
  worktree: string;
}): Promise<CheckoutDatabase[]> {
  const databases = await together(
    (["dev", "test", "e2e"] as const).map((mode) =>
      prepareDatabase({
        database: { fresh: false, mode, seed: false, url: urls[mode] },
        isolated,
        source,
        worktree,
      }),
    ),
  );

  const development = databases.find((database) => database.mode === "dev");

  if (!development?.fresh || !isolated || !(await hasSourceDatabase(source))) {
    return databases;
  }

  await copySourceDatabase({ database: development, source });

  return databases.map((database) =>
    database === development ? { ...database, seed: false } : database,
  );
}

export function migrateDatabase({
  database,
  worktree,
}: {
  database: CheckoutDatabase;
  worktree: string;
}): Promise<string> {
  return prisma({ args: ["migrate", "deploy"], env: urlEnvironment(database), worktree });
}

/** Tests need only the regular seed; a new development database also gets core's Library courses and personas. */
export function seedDatabase({
  database,
  worktree,
}: {
  database: CheckoutDatabase;
  worktree: string;
}): Promise<string> {
  const env = urlEnvironment(database);

  if (database.mode !== "dev") {
    return runDatabaseScript({ env, script: "src/prisma/seed.ts", worktree });
  }

  if (database.seed) {
    return prisma({ args: ["db", "seed"], env, worktree });
  }

  return seedLibrary({ env, worktree });
}
