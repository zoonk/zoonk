import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // No test mocks a module, and each restores the clock, globals and env it changes.
  test: { environment: "node", isolate: false },
});
