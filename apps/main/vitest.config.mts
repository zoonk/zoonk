import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../../packages/db/src/test-environment";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  resolve: {
    alias: [
      {
        // Use auth's testing config in tests to avoid nextCookies() which requires Next.js context
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
  },
});
