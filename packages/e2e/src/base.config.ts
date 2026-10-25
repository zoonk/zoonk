import { defineConfig, devices } from "@playwright/test";
import { assertBrowserLaunchAllowed } from "@zoonk/testing/browser-preflight";
import { getTestEnvironment } from "../../db/src/test-environment";
import { getBaseUrlVariable, getServerCount } from "./fixtures/base-url";

const CHROMIUM_PROJECT = {
  name: "chromium",
  use: { ...devices["Desktop Chrome"], ...(process.env.CI ? { channel: "chrome" as const } : {}) },
};

export function createBaseConfig(options: {
  globalSetup?: string;
  testDir: string;
  webServerEnv?: Record<string, string>;
}) {
  assertBrowserLaunchAllowed();

  return defineConfig({
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: true,
    globalSetup: options.globalSetup,
    projects: [CHROMIUM_PROJECT],
    // CI annotates failures and logs each test with its time, which balances the shards.
    reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
    retries: process.env.CI ? 2 : 0,
    testDir: options.testDir,
    use: {
      screenshot: process.env.CI ? "off" : "only-on-failure",
      // Learners in tests live in UTC, the zone their goals and fixtures date days in, so the
      // learner's day never differs from the UTC day late at night on a machine in another zone.
      timezoneId: "UTC",
      trace: process.env.CI ? "off" : "on-first-retry",
      video: process.env.CI ? "off" : "retain-on-failure",
    },
    // One app server, or one per worker slot with `E2E_SERVERS`: a Node server renders on one core,
    // so a single one held back every worker on CI (`getBaseURL` picks the worker's own).
    webServer: Array.from({ length: getServerCount() }, (_, slot) => ({
      command: "pnpm start -p 0",
      env: {
        ...getTestEnvironment("e2e"),
        STRIPE_SECRET_KEY: "sk_test_fake",
        ...options.webServerEnv,
      },
      // Let pnpm forward shutdown to the server in its separate process group.
      gracefulShutdown: { signal: "SIGTERM" as const, timeout: 10_000 },
      timeout: 120_000,
      // Capture the address from Next.js stdout: "- Local: http://localhost:12345"
      wait: {
        stdout: new RegExp(
          `-\\s+Local:\\s+(?<${getBaseUrlVariable(slot)}>http://localhost:\\d+)`,
          "u",
        ),
      },
    })),
  });
}
