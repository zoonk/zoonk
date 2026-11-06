import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.md"],
  resolve: {
    alias: {
      "server-only": resolve(import.meta.dirname, "packages/core/__mocks__/server-only.ts"),
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: [
      "apps/evals/src/**/*.test.ts",
      "scripts/deploy/*.test.mts",
      "scripts/dev/*.test.mts",
      "scripts/e2e/*.test.mts",
      "scripts/perf/*.test.mts",
      "scripts/theme/*.test.mts",
      "scripts/verify/*.test.mts",
      "scripts/worktree/*.test.mts",
    ],
  },
});
