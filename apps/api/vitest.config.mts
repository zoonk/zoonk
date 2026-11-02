import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../../packages/db/src/test-environment.ts";

/**
 * A mocked module stays mocked in its worker, so files that mock their own run in a fresh worker
 * each; every other file shares workers and loads the app once per worker.
 */
const OWN_MOCKS = globSync(["src/**/*.test.ts", "scripts/**/*.test.ts"], {
  cwd: import.meta.dirname,
}).filter(
  (file) =>
    !file.endsWith(".integration.test.ts") &&
    /\bvi\.(?:mock|doMock|unmock)\(/u.test(
      readFileSync(resolve(import.meta.dirname, file), "utf8"),
    ),
);

export default defineConfig({
  assetsInclude: ["**/*.md"],
  resolve: {
    alias: [
      {
        // Use auth's testing config in tests to avoid nextCookies() which requires Next.js context
        find: /^@zoonk\/auth$/u,
        replacement: resolve(import.meta.dirname, "../../packages/auth/src/testing.ts"),
      },
      { find: /^workflow$/u, replacement: resolve(import.meta.dirname, "./mocks/workflow.ts") },
      {
        find: /^workflow\/api$/u,
        replacement: resolve(import.meta.dirname, "./mocks/workflow-api.ts"),
      },
      {
        find: /^workflow\/runtime$/u,
        replacement: resolve(import.meta.dirname, "./mocks/workflow-runtime.ts"),
      },
      {
        find: /^server-only$/u,
        replacement: resolve(import.meta.dirname, "./mocks/server-only.ts"),
      },
    ],
    // Core resolves its own copy of Next (other peers), so without this its `next/cache` escapes the setup mock.
    dedupe: ["next"],
    tsconfigPaths: true,
  },
  test: {
    env: {
      AI_GATEWAY_API_KEY: "",
      ...getTestRunEnvironment(),
      NEXT_PUBLIC_APP_DOMAIN: "localhost:9002",
    },
    environment: "node",
    // Real Workflow execution runs in its own config (`vitest.workflow.config.mts`).
    exclude: ["**/node_modules/**", "**/e2e/**", "**/*.integration.test.ts"],
    globalSetup: ["../../packages/db/src/test-database.ts"],
    projects: [
      {
        extends: true,
        test: {
          exclude: [
            ...configDefaults.exclude,
            "**/e2e/**",
            "**/*.integration.test.ts",
            ...OWN_MOCKS,
          ],
          isolate: false,
          name: "shared",
        },
      },
      { extends: true, test: { include: OWN_MOCKS, name: "own-mocks" } },
    ],
    setupFiles: ["./setup-tests.ts"],
    // Tests read and write the real database; on CI two suites share a 4-vCPU runner, where a test
    // that takes a second locally takes four or five. A test that hangs still fails.
    testTimeout: 15_000,
  },
});
