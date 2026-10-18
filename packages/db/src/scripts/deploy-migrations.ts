import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

/** Prisma's error when another run holds the migration lock for longer than it waits (10 s). */
const LOCK_TIMEOUT_ERROR = "P1002";
const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 5000;

/**
 * Applies pending migrations (`prisma migrate deploy`). Every Vercel project (main, api and admin)
 * runs it at the start of its build, so no deployment builds or serves code against an older schema.
 * The projects build at the same time: Prisma's advisory lock lets one of them apply the migrations
 * while the others wait, but only for 10 seconds, which isn't configurable. A build that times out
 * tries again once the lock is free and finds nothing left to apply.
 */
async function deployMigrations(attempt = 1): Promise<number> {
  const result = spawnSync("prisma", ["migrate", "deploy"], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  const lockTimedOut = `${result.stdout}${result.stderr}`.includes(LOCK_TIMEOUT_ERROR);

  if (result.status === 0 || !lockTimedOut || attempt >= MAX_ATTEMPTS) {
    return result.status ?? 1;
  }

  await sleep(RETRY_DELAY_MS);
  return deployMigrations(attempt + 1);
}

process.exitCode = await deployMigrations();
