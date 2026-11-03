import { execFile, spawn } from "node:child_process";
import { safeAsync } from "../../packages/utils/src/error.ts";

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

/** A machine busy with parallel agents can take seconds to open a local connection. */
const CONNECT_TIMEOUT_SECONDS = 30;

/** Migrations call `uuidv7()`, which PostgreSQL added in 18. */
const MINIMUM_SERVER_VERSION = 180_000;

/** Finish sibling subprocesses before releasing the setup lock, including on failure. */
export async function together<Values extends readonly unknown[] | []>(
  promises: Values,
): Promise<{ -readonly [Index in keyof Values]: Awaited<Values[Index]> }> {
  const results = await Promise.allSettled(promises);

  const failures = results.flatMap((result) =>
    result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason : new Error(String(result.reason))]
      : [],
  );

  if (failures.length > 0) {
    throw new AggregateError(failures, "Setup failed. Rerun it after resolving the errors.");
  }

  return Promise.all(promises);
}

export async function run({
  args,
  command,
  cwd,
  env = process.env,
  input,
}: {
  args: string[];
  command: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { cwd, env, maxBuffer: MAX_OUTPUT_BYTES },
      (error, stdout) => {
        if (error) {
          reject(new Error(error.message, { cause: error }));
          return;
        }

        resolve(stdout.trim());
      },
    );

    child.stdin?.end(input);
  });
}

/** Credentials travel through the child environment, never command arguments or setup logs. */
export function postgresEnvironment(source: URL): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGCONNECT_TIMEOUT: String(CONNECT_TIMEOUT_SECONDS),
    PGDATABASE: "postgres",
    PGHOST: source.hostname.replaceAll(/^\[|\]$/gu, ""),
    PGOPTIONS: "-c lock_timeout=2000",
    PGPASSWORD: decodeURIComponent(source.password),
    PGPORT: source.port || "5432",
    PGUSER: decodeURIComponent(source.username),
  };
}

export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function query({ source, sql }: { source: URL; sql: string }): Promise<string> {
  return run({
    args: ["-X", "-w", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
    command: "psql",
    env: postgresEnvironment(source),
  });
}

/** A session lock survives subprocesses and is released by PostgreSQL even if the setup agent crashes. */
export async function withDatabaseLock<Result>({
  action,
  source,
  worktree,
}: {
  action: () => Promise<Result>;
  source: URL;
  worktree: string;
}): Promise<Result> {
  const child = spawn("psql", ["-X", "-w", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
    env: postgresEnvironment(source),
    stdio: ["pipe", "pipe", "pipe"],
  });

  const errors: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => errors.push(chunk.toString()));

  try {
    await new Promise<void>((resolve, reject) => {
      const output: string[] = [];
      child.on("error", reject);
      child.on("exit", () => reject(new Error(`Cannot lock worktree setup: ${errors.join("")}`)));

      child.stdout.on("data", (chunk: Buffer) => {
        output.push(chunk.toString());

        if (output.join("").includes("zoonk-lock-acquired")) {
          resolve();
        }
      });

      child.stdin.write(
        `SELECT pg_advisory_lock(hashtext(${sqlLiteral(`zoonk-worktree:${worktree}`)}));\n\\echo zoonk-lock-acquired\n`,
      );
    });

    return await action();
  } finally {
    child.stdin.end("\\q\n");
  }
}

function serverOf(source: URL): string {
  return `${source.hostname}:${source.port || "5432"}`;
}

function isMissingCommand(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.cause instanceof Error &&
    "code" in error.cause &&
    error.cause.code === "ENOENT"
  );
}

/** psql's own first line, without the command that `run` puts before it. */
function reasonOf(error: unknown): string {
  if (isMissingCommand(error)) {
    return "psql isn't on PATH";
  }

  const message = error instanceof Error ? error.message : String(error);
  return (message.split("\n")[1] ?? message).replace(/^psql: error: /u, "").trim();
}

function unreachable({ error, source }: { error: unknown; source: URL }): string {
  return [
    `Can't use PostgreSQL at ${serverOf(source)} as ${decodeURIComponent(source.username)}: ${reasonOf(error)}`,
    "Install PostgreSQL 18 and start it, then rerun this command:",
    "  macOS: brew install postgresql@18 && brew services start postgresql@18, with $(brew --prefix postgresql@18)/bin on PATH",
    "  Ubuntu: bash scripts/cloud/setup.sh",
    "Or set DATABASE_URL in packages/db/.env to a PostgreSQL 18 server on this machine.",
  ].join("\n");
}

async function serverVersion(source: URL): Promise<number> {
  return Number(await query({ source, sql: "SHOW server_version_num" }));
}

async function createRole(source: URL): Promise<void> {
  const environment = Object.fromEntries(
    Object.entries(postgresEnvironment(source)).filter(
      ([name]) => name !== "PGUSER" && name !== "PGPASSWORD",
    ),
  );

  const role = `"${decodeURIComponent(source.username).replaceAll('"', '""')}"`;
  const password = sqlLiteral(decodeURIComponent(source.password));

  await run({
    args: [
      "-X",
      "-w",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE ROLE ${role} WITH LOGIN SUPERUSER PASSWORD ${password}`,
    ],
    command: "psql",
    env: environment,
  });
}

/** Homebrew's server has only the OS user's role, which may create the one the URL names. */
async function connect(source: URL): Promise<number> {
  try {
    return await serverVersion(source);
  } catch (error) {
    if (!/role ".+" does not exist/u.test(reasonOf(error))) {
      throw error;
    }

    await createRole(source);
    return serverVersion(source);
  }
}

/** What to do before setup can go on: the server is down, older than 18, or has no role for the URL and can't make one. */
export async function findPostgresProblem(source: URL): Promise<string | null> {
  const { data: version, error } = await safeAsync(() => connect(source));

  if (error) {
    return unreachable({ error, source });
  }

  return version < MINIMUM_SERVER_VERSION
    ? `PostgreSQL 18 is required, since migrations call uuidv7(), but ${serverOf(source)} runs version ${version}. Start PostgreSQL 18 there instead, or set DATABASE_URL in packages/db/.env to one.`
    : null;
}
