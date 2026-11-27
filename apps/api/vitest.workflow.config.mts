import { resolve } from "node:path";
import { workflowTransformPlugin } from "@workflow/rollup";
import { defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../../packages/db/src/test-environment.ts";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  plugins: [workflowTransformPlugin({ exclude: [".workflow-vitest/"] })],
  resolve: {
    alias: [
      {
        find: /^server-only$/u,
        replacement: resolve(import.meta.dirname, "./mocks/server-only.ts"),
      },
    ],
    dedupe: ["next"],
    tsconfigPaths: true,
  },
  test: {
    env: {
      ...getTestRunEnvironment(),
      AI_GATEWAY_API_KEY: "",
      NEXT_PUBLIC_APP_DOMAIN: "localhost:9002",
      OPENAI_API_KEY: "",
    },
    environment: "node",
    globalSetup: ["../../packages/db/src/test-database.ts", "./workflow-test-bundle.ts"],
    include: ["src/**/*.integration.test.ts"],
    // On CI's 4-vCPU runners, 3 files at once took a third of the time of 1, and 4 no less; 6 or
    // more starved steps past their inline lease, so they ran twice and tests failed.
    maxWorkers: 3,
    server: { deps: { inline: [/@workflow\/vitest/u] } },
    setupFiles: ["./setup-workflow-tests.ts"],
    silent: "passed-only",
    // The Workflow runtime waits at least 1 s before each step retry, so a step that uses all 3 of
    // its retries holds its test for 3 s. A file's first run also loads the workflow bundle, which
    // with 3 files at once on CI took a first test up to 15 s.
    testTimeout: 30_000,
  },
});
