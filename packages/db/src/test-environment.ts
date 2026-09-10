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
