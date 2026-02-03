import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        // Use @zoonk/auth/testing in tests to avoid nextCookies() which requires Next.js context
        find: /^@zoonk\/auth$/,
        replacement: resolve(__dirname, "../../packages/auth/src/testing.ts"),
      },
      {
        // Mock server-only module
        find: /^server-only$/,
        replacement: resolve(__dirname, "./mocks/server-only.ts"),
      },
    ],
  },
  test: {
    env: {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/zoonk_test",
      DATABASE_URL_UNPOOLED: "postgres://postgres:postgres@localhost:5432/zoonk_test",
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    setupFiles: ["./setup-tests.ts"],
  },
});
