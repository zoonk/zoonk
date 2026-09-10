import { defineConfig, devices } from "@playwright/test";
import { getTestEnvironment } from "@zoonk/db/test-environment";

const CHROMIUM_PROJECT = {
  name: "chromium",
  use: { ...devices["Desktop Chrome"], ...(process.env.CI ? { channel: "chrome" as const } : {}) },
};

export function createBaseConfig(options: {
  globalSetup?: string;
  testDir: string;
  webServerEnv?: Record<string, string>;
}) {
  return defineConfig({
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: true,
    globalSetup: options.globalSetup,
    projects: [CHROMIUM_PROJECT],
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
    retries: process.env.CI ? 2 : 0,
    testDir: options.testDir,
    use: {
      screenshot: process.env.CI ? "off" : "only-on-failure",
      trace: process.env.CI ? "off" : "on-first-retry",
      video: process.env.CI ? "off" : "retain-on-failure",
    },
    webServer: {
      command: "pnpm start -p 0",
      env: {
        ...getTestEnvironment("e2e"),
        STRIPE_SECRET_KEY: "sk_test_fake",
        ...options.webServerEnv,
      },
      timeout: 120_000,
      // Capture port from Next.js stdout: "- Local: http://localhost:12345"
      wait: { stdout: /-\s+Local:\s+(?<E2E_BASE_URL>http:\/\/localhost:(?<E2E_PORT>\d+))/u },
    },
  });
}
