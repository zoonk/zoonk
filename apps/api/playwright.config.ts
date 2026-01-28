import { createBaseConfig } from "@zoonk/e2e/base.config";

export default createBaseConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  webServerEnv: {
    BETTER_AUTH_SECRET: "e2e-test-secret-for-local-testing-only",
  },
});
