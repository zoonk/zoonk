import { defineConfig, devices } from "@playwright/test";

type BaseConfigOptions = {
  baseURL: string;
  globalSetup?: string;
  port: number;
  testDir: string;
  webServerEnv?: Record<string, string>;
};

export function createBaseConfig(options: BaseConfigOptions) {
  return defineConfig({
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: true,
    globalSetup: options.globalSetup,
    projects: [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] },
      },
    ],
    reporter: process.env.CI
      ? [["github"], ["html", { open: "never" }]]
      : [["list"]],
    retries: process.env.CI ? 2 : 0,
    testDir: options.testDir,
    use: {
      baseURL: options.baseURL,
      screenshot: "only-on-failure",
      trace: "on-first-retry",
      video: "retain-on-failure",
    },
    webServer: {
      command: `pnpm start -p ${options.port}`,
      env: {
        // biome-ignore lint/style/useNamingConvention: environment variable naming
        E2E_TESTING: "true",
        ...options.webServerEnv,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: options.baseURL,
    },
  });
}
