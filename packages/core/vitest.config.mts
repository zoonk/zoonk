import { globSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../db/src/test-environment.ts";

/** Match the apps' raw-loader so prompt versions agree with production. */
const markdownAsText = {
  enforce: "pre" as const,
  name: "markdown-as-text",
  transform(code: string, id: string) {
    return id.endsWith(".md") ? `export default ${JSON.stringify(code)};` : null;
  },
};

/** Each node-postgres worker pool may open 10 connections; one worker per core exceeds PostgreSQL's default 100. */
const MAX_DATABASE_WORKERS = 6;

/** File-local module mocks persist in shared workers, so those files require isolation. */
const OWN_MOCKS = globSync("src/**/*.test.ts", { cwd: import.meta.dirname }).filter((file) =>
  /\bvi\.(?:mock|doMock|unmock)\(/u.test(readFileSync(resolve(import.meta.dirname, file), "utf8")),
);

/** These files change live-call admission and the shared free day, which every learner's call reads. */
const LIVE_CALL_POLICY_TEST = "src/language/conversations/live-calls.test.ts";
const MISSION_COMPLETION_TEST = "src/mistakes/mission-completion-paths.test.ts";
/** Table-wide locks must run after parallel files and apart from one another. */
const REQUEST_INSTANT_TEST = "src/learner/facts/request-instant.test.ts";
const OPEN_GOAL_INPUT_RACE_TEST = "src/sessions/open-goal-input-race.test.ts";
const ORDERED_CALL_TESTS = [LIVE_CALL_POLICY_TEST, MISSION_COMPLETION_TEST];
const ORDERED_TESTS = [...ORDERED_CALL_TESTS, REQUEST_INSTANT_TEST, OPEN_GOAL_INPUT_RACE_TEST];

const ISOLATED_MOCK_TESTS = OWN_MOCKS.filter((file) => !ORDERED_TESTS.includes(file));
const MISSION_TEST_GROUP = 1;
const LIVE_CALL_POLICY_TEST_GROUP = 2;

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
          fileParallelism: false,
          include: [MISSION_COMPLETION_TEST, REQUEST_INSTANT_TEST, OPEN_GOAL_INPUT_RACE_TEST],
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
    ],
    setupFiles: ["./setup-tests.ts"],
    testTimeout: 15_000,
  },
});
