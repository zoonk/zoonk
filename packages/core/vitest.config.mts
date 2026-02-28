import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        // Use @zoonk/auth/testing in tests to avoid nextCookies() which requires Next.js context
        find: /^@zoonk\/auth$/,
        replacement: resolve(import.meta.dirname, "../auth/src/testing.ts"),
      },
    ],
  },
  test: {
    deps: {
      optimizer: { ssr: { include: ["next"] } },
    },
    env: {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/zoonk_test",
      DATABASE_URL_UNPOOLED: "postgres://postgres:postgres@localhost:5432/zoonk_test",
      NEXT_PUBLIC_APP_DOMAIN: "localhost:9000",
    },
    environment: "node",
    setupFiles: ["./setup-tests.ts"],
  },
});
