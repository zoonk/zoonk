import { defineConfig, devices } from "@playwright/test";

type BaseConfigOptions = {
  globalSetup?: string;
  testDir: string;
  webServerEnv?: Record<string, string>;
};

const E2E_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/zoonk_e2e";

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
      screenshot: "only-on-failure",
      trace: "on-first-retry",
      video: "retain-on-failure",
    },
    webServer: {
      command: "pnpm start -p 0",
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        DATABASE_URL_UNPOOLED: E2E_DATABASE_URL,
        E2E_TESTING: "true",
        ...options.webServerEnv,
      },
      timeout: 120_000,
      // Capture port from Next.js stdout: "- Local: http://localhost:12345"
      wait: {
        stdout:
          /-\s+Local:\s+(?<E2E_BASE_URL>http:\/\/localhost:(?<E2E_PORT>\d+))/,
      },
    },
  });
}
