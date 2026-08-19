import { createBaseConfig } from "@zoonk/e2e/base.config";

export default createBaseConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  webServerEnv: {
    APPLE_IAP_ALLOW_XCODE_TRANSACTIONS: "true",
    APPLE_IAP_BUNDLE_ID: "com.zoonk",
    APPLE_IAP_ISSUER_ID: "",
    APPLE_IAP_KEY_ID: "",
    APPLE_IAP_PRIVATE_KEY: "",
    APPLE_IAP_XCODE_BUNDLE_ID: "com.zoonk.dev",
  },
});
