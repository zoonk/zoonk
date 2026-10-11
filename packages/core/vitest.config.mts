import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { getTestRunEnvironment } from "@zoonk/db/test-environment";
import { durationSequencer } from "@zoonk/testing/vitest/duration-sequencer";
import { defineConfig } from "vitest/config";
import durations from "./vitest.durations.json" with { type: "json" };

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
    sequence: { sequencer: durationSequencer(durations) },
    setupFiles: ["./setup-tests.ts"],
  },
});
