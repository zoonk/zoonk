import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  plugins: [tsconfigPaths()],
  test: {
    env: loadEnv("test", process.cwd(), ""),
    environment: "node",
    setupFiles: "./setup-tests.ts",
  },
});
