import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { worktreeDatabaseName } from "./environment.mts";
import { postgresEnvironment, query, run, sqlLiteral, together } from "./postgres.mts";

export type WorktreeDatabase = { mode: "dev" | "test" | "e2e"; name: string; ready: boolean };

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
    return { mode, name, ready: true };
  }

  if (state && state !== "false") {
    throw new Error(`Refusing to replace unmanaged database ${name}.`);
  }

  /** Only unfinished databases from this worktree's previous setup may be rebuilt. Never force a disconnect. */
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
    /** A logical snapshot works while the primary checkout has open connections. */
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
