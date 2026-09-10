import { getTestEnvironment } from "@zoonk/db/test-environment";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { env: { ...getTestEnvironment("test") }, environment: "node" },
});
