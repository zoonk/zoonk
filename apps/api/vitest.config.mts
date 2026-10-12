import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../../packages/db/src/test-environment";

/**
 * Test files that mock modules of their own (`vi.mock`, `vi.doMock`, `vi.unmock`): a mocked module
 * stays mocked in its worker, so these run in a fresh worker each. Every other file shares workers
 * and pays for loading the app, core, Prisma and its compiled queries once per worker instead of
 * once per file; the edges every test replaces are declared once in `setup-tests.ts`.
 */
const OWN_MOCKS = globSync(["src/**/*.test.ts", "scripts/**/*.test.ts"], {
  cwd: import.meta.dirname,
}).filter((file) =>
  /\bvi\.(?:mock|doMock|unmock)\(/u.test(readFileSync(resolve(import.meta.dirname, file), "utf8")),
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
      {
        // Provide one shared workflow mock so workflow integration tests can reuse the same plumbing.
        find: /^workflow$/u,
        replacement: resolve(import.meta.dirname, "./mocks/workflow.ts"),
      },
      {
        // Runs only exist inside the workflow runtime: tests say what started and how a run stands.
        find: /^workflow\/api$/u,
        replacement: resolve(import.meta.dirname, "./mocks/workflow-api.ts"),
      },
      {
        // The World's events only exist inside the workflow runtime; tests say what a run recorded.
        find: /^workflow\/runtime$/u,
        replacement: resolve(import.meta.dirname, "./mocks/workflow-runtime.ts"),
      },
      {
        // Mock server-only module
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
    exclude: ["**/node_modules/**", "**/e2e/**"],
    globalSetup: ["../../packages/db/src/test-database.ts"],
    projects: [
      {
        extends: true,
        test: {
          exclude: [...configDefaults.exclude, "**/e2e/**", ...OWN_MOCKS],
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
