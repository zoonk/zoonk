import { createBaseConfig } from "@zoonk/e2e/base.config";

export default createBaseConfig({
  globalSetup: "./e2e/global-setup.ts",
  needsApiServer: true,
  testDir: "./e2e",
});
