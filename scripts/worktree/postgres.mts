import { execFile, spawn } from "node:child_process";

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

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
    throw new AggregateError(
      failures,
      "Worktree setup failed. Rerun pnpm worktree:setup after resolving the errors.",
    );
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
    PGCONNECT_TIMEOUT: "2",
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
