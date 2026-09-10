import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { getPnpmCommand } from "../dev/process.mts";
import { pruneDatabases } from "./cleanup.mts";
import { type WorktreeDatabase, markDatabase, prepareDatabases } from "./databases.mts";
import {
  copyEnvironment,
  databaseEnvironment,
  localSource,
  writeEnvironment,
} from "./environment.mts";
import { query, run, together, withDatabaseLock } from "./postgres.mts";

const worktree = realpathSync(resolve(import.meta.dirname, "../.."));
const databaseDirectory = join(worktree, "packages/db");
const requireDatabase = createRequire(join(databaseDirectory, "package.json"));

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function installDependencies(): Promise<string> {
  const pnpm = getPnpmCommand(process.env);

  /** Direct setup calls have no npm_execpath, and pnpm may only be a .cmd shim on Windows. */
  if (process.platform === "win32" && pnpm.command === "pnpm") {
    return run({
      args: ["/d", "/s", "/c", "pnpm install --frozen-lockfile --prefer-offline"],
      command: process.env.ComSpec || "cmd.exe",
      cwd: worktree,
    });
  }

  return run({
    args: [...pnpm.args, "install", "--frozen-lockfile", "--prefer-offline"],
    command: pnpm.command,
    cwd: worktree,
  });
}

function prisma({
  args,
  env = process.env,
}: {
  args: string[];
  env?: NodeJS.ProcessEnv;
}): Promise<string> {
  return run({
    args: [requireDatabase.resolve("prisma/build/index.js"), ...args],
    command: process.execPath,
    cwd: databaseDirectory,
    env,
  });
}

async function initializeTestDatabase({
  database,
  source,
}: {
  database: WorktreeDatabase;
  source: URL;
}): Promise<void> {
  await run({
    args: [requireDatabase.resolve("tsx/cli"), "src/prisma/seed.ts"],
    command: process.execPath,
    cwd: databaseDirectory,
    env: { ...process.env, ...databaseEnvironment({ name: database.name, source }) },
  });

  await markDatabase({ database, ready: true, source, worktree });
}

async function setupIsolatedDatabases(source: URL): Promise<void> {
  writeEnvironment({ source, worktree });
  log("Installing dependencies and copying the local database in parallel…");

  const [, databases] = await together([
    installDependencies(),
    prepareDatabases({ source, worktree }),
  ]);

  const freshTests = databases.filter((database) => database.mode !== "dev" && !database.ready);
  log("Generating Prisma and preparing test databases…");

  await together([
    prisma({ args: ["generate"] }),
    ...freshTests.map((database) =>
      prisma({
        args: ["migrate", "deploy"],
        env: { ...process.env, ...databaseEnvironment({ name: database.name, source }) },
      }),
    ),
  ]);

  await together(freshTests.map((database) => initializeTestDatabase({ database, source })));
  await pruneDatabases({ source, worktree });
  log(`Databases ready: ${databases.map((database) => database.name).join(", ")}`);
}

async function main(): Promise<void> {
  const started = performance.now();

  const commonDirectory = await run({
    args: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    command: "git",
    cwd: worktree,
  });

  const primary = realpathSync(dirname(commonDirectory));
  copyEnvironment({ primary, worktree });
  const source = primary === worktree || process.env.CI ? null : localSource(primary);

  const hasSource =
    source && (await query({ source, sql: "SELECT 1 FROM pg_database WHERE datname = 'zoonk'" }));

  if (source && hasSource) {
    await withDatabaseLock({ action: () => setupIsolatedDatabases(source), source, worktree });
  } else {
    log(
      "Skipping database isolation: this is the primary checkout, or no local zoonk source is configured/present.",
    );

    await installDependencies();
    await prisma({ args: ["generate"] });
  }

  log(`Worktree ready in ${((performance.now() - started) / 1000).toFixed(2)}s.`);
}

await main();
