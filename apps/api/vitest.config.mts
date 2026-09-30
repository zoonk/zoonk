import { resolve } from "node:path";
import { getTestEnvironment } from "@zoonk/db/test-environment";
import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  resolve: {
    alias: [
      {
        // Use @zoonk/auth/testing in tests to avoid nextCookies() which requires Next.js context
        find: /^@zoonk\/auth$/u,
        replacement: resolve(import.meta.dirname, "../../packages/auth/src/testing.ts"),
      },
      {
        // Provide one shared workflow mock so workflow integration tests can reuse the same plumbing.
        find: /^workflow$/u,
        replacement: resolve(import.meta.dirname, "./mocks/workflow.ts"),
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
      ...getTestEnvironment("test"),
      NEXT_PUBLIC_APP_DOMAIN: "localhost:9002",
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    globalSetup: ["./vitest.global-setup.ts"],
    setupFiles: ["./setup-tests.ts"],
  },
});
