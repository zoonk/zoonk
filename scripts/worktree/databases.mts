import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ownDevelopmentDatabaseUrl, worktreeDatabaseName } from "./environment.mts";
import { postgresEnvironment, query, run, sqlLiteral, together } from "./postgres.mts";

export type WorktreeDatabase = { mode: "dev" | "test" | "e2e"; name: string; ready: boolean };

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

/** Does nothing unless the checkout uses this worktree's own copy, so the primary checkout's `zoonk` is never migrated. */
export async function migrateDevelopmentDatabase(worktree: string): Promise<void> {
  const url = ownDevelopmentDatabaseUrl(worktree);

  if (url) {
    await prisma({
      args: ["migrate", "deploy"],
      env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
      worktree,
    });
  }
}

export function markDatabase({
  database,
  ready,
  source,
  worktree,
}: {
  database: WorktreeDatabase;
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
    source,
    sql: `COMMENT ON DATABASE "${database.name}" IS ${sqlLiteral(metadata)}`,
  });
}

async function prepareDatabase({
  mode,
  source,
  worktree,
}: {
  mode: WorktreeDatabase["mode"];
  source: URL;
  worktree: string;
}): Promise<WorktreeDatabase> {
  const name = worktreeDatabaseName({ mode, worktree });

  const state = await query({
    source,
    sql: `SELECT CASE
      WHEN shobj_description(oid, 'pg_database') IS JSON OBJECT THEN
        CASE WHEN shobj_description(oid, 'pg_database')::jsonb->>'owner' = 'zoonk-worktree-v1'
          AND shobj_description(oid, 'pg_database')::jsonb->>'worktree' = ${sqlLiteral(worktree)}
        THEN shobj_description(oid, 'pg_database')::jsonb->>'ready' ELSE 'unmanaged' END
      ELSE 'unmanaged' END FROM pg_database WHERE datname = ${sqlLiteral(name)}`,
  });

  if (state === "true") {
    const database = { mode, name, ready: true };
    // A fresh mark keeps a cleanup that found this worktree missing from dropping its copies.
    await markDatabase({ database, ready: true, source, worktree });
    return database;
  }

  if (state && state !== "false") {
    throw new Error(`Refusing to replace unmanaged database ${name}.`);
  }

  // Only unfinished databases from this worktree's previous setup may be rebuilt. Never force a
  // disconnect.
  if (state === "false") {
    await query({ source, sql: `DROP DATABASE "${name}"` });
  }

  await query({ source, sql: `CREATE DATABASE "${name}" TEMPLATE template0` });
  const database = { mode, name, ready: false };
  await markDatabase({ database, ready: false, source, worktree });
  return database;
}

async function copyDevelopmentDatabase({
  database,
  source,
  worktree,
}: {
  database: WorktreeDatabase;
  source: URL;
  worktree: string;
}): Promise<void> {
  if (database.ready) {
    return;
  }

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
        database.name,
        "--no-owner",
        "--no-acl",
        "--exit-on-error",
        "--single-transaction",
        archive,
      ],
      command: "pg_restore",
      env,
    });

    await markDatabase({ database, ready: true, source, worktree });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

export async function prepareDatabases({
  source,
  worktree,
}: {
  source: URL;
  worktree: string;
}): Promise<WorktreeDatabase[]> {
  const databases = await together(
    (["dev", "test", "e2e"] as const).map((mode) => prepareDatabase({ mode, source, worktree })),
  );

  const development = databases.find((database) => database.mode === "dev");

  if (!development) {
    throw new Error("Missing development database.");
  }

  await copyDevelopmentDatabase({ database: development, source, worktree });
  return databases;
}
