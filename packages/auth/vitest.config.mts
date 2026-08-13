import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    env: {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/zoonk_test",
      DATABASE_URL_UNPOOLED: "postgres://postgres:postgres@localhost:5432/zoonk_test",
    },
    environment: "node",
  },
});
