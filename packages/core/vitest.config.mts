import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    env: {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/zoonk_test",
      DATABASE_URL_UNPOOLED:
        "postgres://postgres:postgres@localhost:5432/zoonk_test",
    },
    environment: "node",
    setupFiles: ["./setup-tests.ts"],
  },
});
