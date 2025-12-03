import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    deps: {
      optimizer: { ssr: { include: ["next"] } },
    },
    environment: "node",
    setupFiles: "./setup-tests.ts",
  },
});
