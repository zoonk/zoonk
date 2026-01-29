import { defineConfig, devices } from "@playwright/test";

const E2E_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/zoonk_e2e";
const API_PORT = 3005;
const API_URL = `http://localhost:${API_PORT}`;

export function createBaseConfig(options: {
  globalSetup?: string;
  needsApiServer?: boolean;
  testDir: string;
  webServerEnv?: Record<string, string>;
}) {
  const baseEnv = {
    DATABASE_URL: E2E_DATABASE_URL,
    DATABASE_URL_UNPOOLED: E2E_DATABASE_URL,
    E2E_TESTING: "true",
    ...options.webServerEnv,
  };

  const appServer = {
    command: "pnpm start -p 0",
    env: {
      ...baseEnv,
      NEXT_PUBLIC_API_URL: API_URL,
    },
    timeout: 120_000,
    wait: {
      stdout: /-\s+Local:\s+(?<E2E_BASE_URL>http:\/\/localhost:(?<E2E_PORT>\d+))/,
    },
  };

  const apiServer = {
    command: `pnpm --filter api start -p ${API_PORT}`,
    cwd: "../..",
    env: {
      ...baseEnv,
      BETTER_AUTH_SECRET: "e2e-test-secret-for-local-testing-only",
      NEXT_PUBLIC_API_URL: API_URL,
    },
    timeout: 120_000,
    url: `${API_URL}/health`,
  };

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
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
    retries: process.env.CI ? 2 : 0,
    testDir: options.testDir,
    use: {
      screenshot: "only-on-failure",
      trace: "on-first-retry",
      video: "retain-on-failure",
    },
    webServer: options.needsApiServer ? [apiServer, appServer] : appServer,
  });
}

export const E2E_API_URL = API_URL;
