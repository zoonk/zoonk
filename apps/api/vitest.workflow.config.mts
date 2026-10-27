import { resolve } from "node:path";
import { workflowTransformPlugin } from "@workflow/rollup";
import { defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../../packages/db/src/test-environment.ts";

/**
 * Real Workflow execution with `@workflow/vitest`'s manual setup: the app's workflows compile into
 * one bundle (`workflow-test-bundle.ts`) and run in-process on a local World. The bundle loads
 * through Vitest's module runner, so its steps run real core against the test database while a
 * test's `vi.mock` replaces the AI provider.
 */
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
    maxWorkers: 1,
    server: { deps: { inline: [/@workflow\/vitest/u] } },
    setupFiles: ["./setup-workflow-tests.ts"],
    testTimeout: 60_000,
  },
});
