import { createBaseConfig } from "@zoonk/e2e/base.config";

const config = createBaseConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  // Fixed test fixture only; Main never forwards cache notifications to itself.
  webServerEnv: { APP_CACHE_SECRET: "e2e-cache-tags-secret", MAIN_CACHE_URL: "" },
});

/** Admission-changing cases run after all learner calls, including in the full CI suite. */
const playwrightConfig = {
  ...config,
  projects: [
    ...(config.projects ?? []).map((project) => ({
      ...project,
      testIgnore: "**/live-call-states.test.ts",
    })),
    {
      dependencies: ["chromium"],
      name: "live-call-states",
      testMatch: "**/live-call-states.test.ts",
      use: config.projects?.[0]?.use,
    },
  ],
};

export default playwrightConfig;
