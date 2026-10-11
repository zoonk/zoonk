import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

function readEnvironment(path: string): Record<string, string> {
  const values = parseEnv(readFileSync(path, "utf8"));

  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

/**
 * Keeps Prisma, Vitest, Playwright, and E2E builds on the same database, even when the shell has a development URL.
 * This package entrypoint is for test tooling and is intentionally absent from production app bundles.
 * @public
 */
export function getTestEnvironment(mode: "test" | "e2e"): Record<string, string> {
  const directory = resolve(import.meta.dirname, "..");
  const defaults = readEnvironment(resolve(directory, `.env.${mode}`));
  const localPath = resolve(directory, `.env.${mode}.local`);

  if (process.env.CI) {
    const pooled =
      process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || defaults.DATABASE_URL;

    const unpooled =
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL ||
      defaults.DATABASE_URL_UNPOOLED;

    return {
      ...Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, process.env[key] ?? value]),
      ),
      ...(pooled && { DATABASE_URL: pooled }),
      ...(unpooled && { DATABASE_URL_UNPOOLED: unpooled }),
    };
  }

  return { ...defaults, ...(existsSync(localPath) && readEnvironment(localPath)) };
}

/** Marks a test run's own copy of the test database; the id of the process that made it follows. */
export const TEST_RUN_DATABASE_MARKER = "_run_";

/** Postgres cuts longer names short. */
const MAX_DATABASE_NAME_LENGTH = 63;

function toRunDatabaseUrl(url: string): string {
  const run = new URL(url);
  const name = `${decodeURIComponent(run.pathname.slice(1))}${TEST_RUN_DATABASE_MARKER}${process.pid}`;

  if (name.length > MAX_DATABASE_NAME_LENGTH) {
    throw new Error(`The test run's database name ${name} is longer than Postgres allows.`);
  }

  run.pathname = `/${encodeURIComponent(name)}`;
  return run.toString();
}

/**
 * The test environment pointing at this run's own copy of the test database, for a Vitest config's
 * `test.env`. The `@zoonk/db/test-database` global setup creates that copy and drops it after the
 * run; the copy is named after the process, which runs both the config and its global setup.
 */
export function getTestRunEnvironment(): Record<string, string> {
  const environment = getTestEnvironment("test");
  const { DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: unpooled } = environment;

  if (!pooled || !unpooled) {
    throw new Error("The test environment has no DATABASE_URL and DATABASE_URL_UNPOOLED.");
  }

  return {
    ...environment,
    DATABASE_URL: toRunDatabaseUrl(pooled),
    DATABASE_URL_UNPOOLED: toRunDatabaseUrl(unpooled),
  };
}
