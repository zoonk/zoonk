import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../../packages/db/src/test-environment.ts";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  resolve: {
    alias: [
      {
        // nextCookies() needs a Next.js request context.
        find: /^@zoonk\/auth$/u,
        replacement: resolve(import.meta.dirname, "../../packages/auth/src/testing.ts"),
      },
    ],
    tsconfigPaths: true,
  },
  test: {
    deps: { optimizer: { ssr: { include: ["next"] } } },
    env: { ...getTestRunEnvironment(), NEXT_PUBLIC_APP_DOMAIN: "localhost:9000" },
    environment: "node",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    globalSetup: ["../../packages/db/src/test-database.ts"],
    server: {
      deps: {
        // https://github.com/vercel/next.js/issues/77200
        inline: ["next-intl"],
      },
    },
    setupFiles: "./setup-tests.ts",
    // On CI two real-database suites share a 4-vCPU runner, where a 1-second test takes four or five.
    testTimeout: 15_000,
  },
});
