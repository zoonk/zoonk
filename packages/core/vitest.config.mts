import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  resolve: {
    alias: { "server-only": resolve(import.meta.dirname, "__mocks__/server-only.ts") },
    tsconfigPaths: true,
  },
  test: {
    env: {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/zoonk_test",
      DATABASE_URL_UNPOOLED: "postgres://postgres:postgres@localhost:5432/zoonk_test",
      NEXT_PUBLIC_APP_DOMAIN: "localhost:9000",
    },
    environment: "node",
    setupFiles: ["./setup-tests.ts"],
  },
});
