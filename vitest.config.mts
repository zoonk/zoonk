import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/deploy/*.test.mts", "scripts/e2e/*.test.mts", "scripts/perf/*.test.mts"],
  },
});
