import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { getLocalDatabaseUrl } from "./local-database.ts";

function readEnvironment(path: string): Record<string, string> {
  const values = existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};

  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

type TestEnvironment = Record<string, string> & {
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED: string;
};

function pairDatabaseUrls(
  source: NodeJS.Dict<string>,
  fallback: TestEnvironment,
): Pick<TestEnvironment, "DATABASE_URL" | "DATABASE_URL_UNPOOLED"> {
  return {
    DATABASE_URL: source.DATABASE_URL || source.DATABASE_URL_UNPOOLED || fallback.DATABASE_URL,
    DATABASE_URL_UNPOOLED:
      source.DATABASE_URL_UNPOOLED || source.DATABASE_URL || fallback.DATABASE_URL_UNPOOLED,
  };
}

function withRunApi(environment: TestEnvironment): TestEnvironment {
  const apiUrl = process.env.E2E_API_URL;
  return apiUrl ? { ...environment, NEXT_PUBLIC_API_URL: apiUrl } : environment;
}

/** Overrides a development URL in the shell, so Prisma, Vitest, Playwright and E2E share one. */
export function getTestEnvironment(mode: "test" | "e2e"): TestEnvironment {
  const directory = resolve(import.meta.dirname, "..");
  const url = getLocalDatabaseUrl(mode);

  const defaults = {
    DATABASE_URL: url,
    DATABASE_URL_UNPOOLED: url,
    ...readEnvironment(resolve(directory, `.env.${mode}`)),
  };

  if (process.env.CI) {
    return withRunApi({
      ...Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, process.env[key] ?? value]),
      ),
      ...pairDatabaseUrls(process.env, defaults),
    });
  }

  const local = readEnvironment(resolve(directory, `.env.${mode}.local`));
  return withRunApi({ ...defaults, ...local, ...pairDatabaseUrls(local, defaults) });
}

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
 * The copy is named after the process, which runs both this config and the `test-database.ts`
 * global setup that creates it.
 */
export function getTestRunEnvironment(): TestEnvironment {
  const environment = getTestEnvironment("test");

  return {
    ...environment,
    DATABASE_URL: toRunDatabaseUrl(environment.DATABASE_URL),
    DATABASE_URL_UNPOOLED: toRunDatabaseUrl(environment.DATABASE_URL_UNPOOLED),
  };
}
