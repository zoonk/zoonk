import { createBaseConfig } from "@zoonk/e2e/base.config";

const config = createBaseConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  webServerEnv: {
    APPLE_IAP_ALLOW_XCODE_TRANSACTIONS: "true",
    APPLE_IAP_BUNDLE_ID: "com.zoonk",
    APPLE_IAP_ISSUER_ID: "",
    APPLE_IAP_KEY_ID: "",
    APPLE_IAP_PRIVATE_KEY: "",
    APPLE_IAP_XCODE_BUNDLE_ID: "com.zoonk.dev",
    // Nothing listens there: tests read where a sign-in that started on the API goes.
    MAIN_APP_URL: "http://localhost:49153",
  },
});

/** Global admission/close-all tests run after learner requests, so their switch cannot leak. */
const playwrightConfig = {
  ...config,
  projects: [
    ...(config.projects ?? []).map((project) => ({
      ...project,
      testIgnore: "**/live-call-admin.test.ts",
    })),
    {
      dependencies: ["chromium"],
      name: "live-call-admin",
      testMatch: "**/live-call-admin.test.ts",
      use: config.projects?.[0]?.use,
    },
  ],
};

export default playwrightConfig;
