// Codex and Claude Code run this file with `node` before a new worktree has dependencies, so nothing
// it imports may come from node_modules.
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getPnpmCommand } from "../dev/process.mts";
import {
  listRemovedWorktrees,
  pruneDatabases,
  stopProcessesInRemovedDirectories,
} from "./cleanup.mts";
import {
  databaseName,
  markDatabase,
  migrateDatabase,
  prepareDatabases,
  prisma,
  seedDatabase,
} from "./databases.mts";
import {
  checkoutDatabaseUrls,
  copyEnvironment,
  localSource,
  writeEnvironment,
} from "./environment.mts";
import { findPostgresProblem, run, together, withDatabaseLock } from "./postgres.mts";

const worktree = realpathSync(resolve(import.meta.dirname, "../.."));

/** `pnpm db:setup` runs after the reader's own `pnpm install`; a new worktree has no dependencies yet. */
const install = !process.argv.includes("--skip-install");

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function installDependencies(): Promise<string> {
  if (!install) {
    return Promise.resolve("");
  }

  const pnpm = getPnpmCommand(process.env);

  // Direct setup calls have no npm_execpath, and pnpm may only be a .cmd shim on Windows.
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

async function cleanUpRemovedWorktrees(source: URL): Promise<void> {
  const stopped = await listRemovedWorktrees(source)
    .then(stopProcessesInRemovedDirectories)
    .catch((error: unknown) => {
      log(
        `Skipped stopping processes in removed worktrees: ${error instanceof Error ? error.message : String(error)}`,
      );

      return [];
    });

  if (stopped.length > 0) {
    log(`Stopped ${stopped.length} processes still running in removed worktrees.`);
  }

  // Another worktree's test run locks its database while copying it; a later setup prunes it.
  await pruneDatabases({ source, worktree }).catch((error: unknown) => {
    log(
      `Skipped pruning idle worktree databases: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}

async function setupDatabases({ isolated, source }: { isolated: boolean; source: URL }) {
  if (isolated) {
    writeEnvironment({ source, worktree });
  }

  log(
    install
      ? "Installing dependencies and preparing the databases in parallel…"
      : "Preparing the databases…",
  );

  const [, databases] = await together([
    installDependencies(),
    prepareDatabases({ isolated, source, urls: checkoutDatabaseUrls(worktree), worktree }),
  ]);

  log("Generating Prisma and applying migrations…");

  await together([
    prisma({ args: ["generate"], worktree }),
    ...databases.map((database) => migrateDatabase({ database, worktree })),
  ]);

  const seeded = databases.filter((database) => database.seed || database.mode === "dev");

  if (seeded.length > 0) {
    log(`Seeding ${seeded.map((database) => databaseName(database)).join(", ")}…`);
  }

  await together(seeded.map((database) => seedDatabase({ database, worktree })));

  await together(
    databases
      .filter((database) => database.fresh)
      .map((database) => markDatabase({ database, ready: true, source, worktree })),
  );

  await cleanUpRemovedWorktrees(source);
  log(`Databases ready: ${databases.map((database) => databaseName(database)).join(", ")}`);
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
  const source = process.env.CI ? null : localSource(primary);

  const problem = source && (await findPostgresProblem(source));

  if (problem) {
    process.stderr.write(`${problem}\n`);
    process.exitCode = 1;
    return;
  }

  if (source) {
    await withDatabaseLock({
      action: () => setupDatabases({ isolated: primary !== worktree, source }),
      source,
      worktree,
    });
  } else {
    log(
      `Skipping the databases: ${process.env.CI ? "CI configures its own" : `${join(primary, "packages/db/.env")} points at a server on another machine`}.`,
    );

    await installDependencies();
    await prisma({ args: ["generate"], worktree });
  }

  log(`Ready in ${((performance.now() - started) / 1000).toFixed(2)}s.`);
}

await main();
