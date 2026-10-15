import { globSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../db/src/test-environment";

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

/** These files change a global policy or use a different clock for live-call health. */
const LIVE_CALL_POLICY_TEST = "src/language/conversations/live-call-lifecycle.test.ts";
const MISSION_COMPLETION_TEST = "src/mistakes/mission-completion-paths.test.ts";
const ORDERED_CALL_TESTS = [LIVE_CALL_POLICY_TEST, MISSION_COMPLETION_TEST];
/** Recovery holds one database-wide advisory lock; unrelated merges intentionally refuse it. */
const SKILL_RECOVERY_TESTS = [
  "src/library/plan-input-writers.test.ts",
  "src/mistakes/backfill-lesson-mistakes-merge.test.ts",
  "src/mistakes/backfill-lesson-mistakes.test.ts",
];

const ORDERED_TESTS = [...ORDERED_CALL_TESTS, ...SKILL_RECOVERY_TESTS];
const ISOLATED_MOCK_TESTS = OWN_MOCKS.filter((file) => !ORDERED_TESTS.includes(file));
const MISSION_TEST_GROUP = 1;
const LIVE_CALL_POLICY_TEST_GROUP = 2;
const SKILL_RECOVERY_TEST_GROUP = 3;

export default defineConfig({
  plugins: [markdownAsText],
  resolve: {
    alias: { "server-only": resolve(import.meta.dirname, "__mocks__/server-only.ts") },
    tsconfigPaths: true,
  },
  test: {
    env: { ...getTestRunEnvironment(), NEXT_PUBLIC_APP_DOMAIN: "localhost:9000" },
    environment: "node",
    globalSetup: ["./global-setup.mts"],
    // Fewer cores than that (CI's runners have 4) get one worker each, so the database work they
    // share isn't starved of CPU.
    maxWorkers: Math.min(MAX_DATABASE_WORKERS, availableParallelism()),
    projects: [
      {
        extends: true,
        test: {
          exclude: [...configDefaults.exclude, ...OWN_MOCKS, ...ORDERED_TESTS],
          isolate: false,
          name: "shared",
        },
      },
      { extends: true, test: { include: ISOLATED_MOCK_TESTS, name: "own-mocks" } },
      {
        extends: true,
        test: {
          include: [MISSION_COMPLETION_TEST],
          name: "mission-completion",
          sequence: { groupOrder: MISSION_TEST_GROUP },
        },
      },
      {
        extends: true,
        test: {
          include: [LIVE_CALL_POLICY_TEST],
          name: "live-call-policy",
          sequence: { groupOrder: LIVE_CALL_POLICY_TEST_GROUP },
        },
      },
      {
        extends: true,
        test: {
          fileParallelism: false,
          include: SKILL_RECOVERY_TESTS,
          name: "skill-recovery",
          sequence: { groupOrder: SKILL_RECOVERY_TEST_GROUP },
        },
      },
    ],
    setupFiles: ["./setup-tests.ts"],
    // Tests read and write the real database; on CI two suites share a 4-vCPU runner, where a test
    // that takes a second locally takes four or five. A test that hangs still fails.
    testTimeout: 15_000,
  },
});
