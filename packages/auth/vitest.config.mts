import { getTestRunEnvironment } from "@zoonk/db/test-environment";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    env: { ...getTestRunEnvironment(), NEXT_PUBLIC_APP_DOMAIN: "localhost:3000" },
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
  },
});
