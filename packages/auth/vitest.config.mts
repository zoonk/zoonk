import { defineConfig } from "vitest/config";
import { getTestRunEnvironment } from "../db/src/test-environment";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    env: { ...getTestRunEnvironment(), NEXT_PUBLIC_APP_DOMAIN: "localhost:3000" },
    environment: "node",
    globalSetup: ["../db/src/test-database.ts"],
  },
});
