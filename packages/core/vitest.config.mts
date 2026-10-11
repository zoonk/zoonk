import { globSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { getTestRunEnvironment } from "@zoonk/db/test-environment";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * Prompts load as their text, as the apps' raw-loader serves them, so a prompt's version here is
 * the one production records (stored readings and fixtures compare against it).
 */
const markdownAsText = {
  enforce: "pre" as const,
  name: "markdown-as-text",
  transform(code: string, id: string) {
    return id.endsWith(".md") ? `export default ${JSON.stringify(code)};` : null;
  },
};

/**
 * Every worker opens up to 10 connections to the one test database (node-postgres' pool), and
 * fixtures create rows in parallel, so one worker per core overflows Postgres' default 100.
 */
const MAX_DATABASE_WORKERS = 6;

/**
 * Test files that mock modules of their own (`vi.mock`, `vi.doMock`, `vi.unmock`): a mocked module
 * stays mocked in its worker, so these run in a fresh worker each. Every other file shares workers
 * and pays for loading core, Prisma and its compiled queries once per worker instead of once per
 * file, which took most of a database test's time; the edges every test replaces are declared once
 * in `setup-tests.ts`.
 */
const OWN_MOCKS = globSync("src/**/*.test.ts", { cwd: import.meta.dirname }).filter((file) =>
  /\bvi\.(?:mock|doMock|unmock)\(/u.test(readFileSync(resolve(import.meta.dirname, file), "utf8")),
);

export default defineConfig({
  plugins: [markdownAsText],
  resolve: {
    alias: { "server-only": resolve(import.meta.dirname, "__mocks__/server-only.ts") },
    tsconfigPaths: true,
  },
  test: {
    env: { ...getTestRunEnvironment(), NEXT_PUBLIC_APP_DOMAIN: "localhost:9000" },
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
    // Fewer cores than that (CI's runners have 4) get one worker each, so the database work they
    // share isn't starved of CPU.
    maxWorkers: Math.min(MAX_DATABASE_WORKERS, availableParallelism()),
    projects: [
      {
        extends: true,
        test: {
          exclude: [...configDefaults.exclude, ...OWN_MOCKS],
          isolate: false,
          name: "shared",
        },
      },
      { extends: true, test: { include: OWN_MOCKS, name: "own-mocks" } },
    ],
    setupFiles: ["./setup-tests.ts"],
  },
});
