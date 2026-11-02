import { createBaseConfig } from "@zoonk/e2e/base.config";

const config = createBaseConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  webServerPort: process.env.MAIN_APP_URL ? Number(new URL(process.env.MAIN_APP_URL).port) : 0,
});

/** A project of its own so CI runs it as its own job (`.github/workflows/e2e-main.yml`). */
const playwrightConfig = {
  ...config,
  projects: [
    ...(config.projects ?? []).map((project) => ({
      ...project,
      testIgnore: "**/live-call-states.test.ts",
    })),
    {
      name: "live-call-states",
      testMatch: "**/live-call-states.test.ts",
      use: config.projects?.[0]?.use,
    },
  ],
};

export default playwrightConfig;
