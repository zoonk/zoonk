import { createBaseConfig } from "@zoonk/e2e/base.config";

const config = createBaseConfig({ globalSetup: "./e2e/global-setup.ts", testDir: "./e2e" });

/** These cases change call admission, so they run after every other learner call. */
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
