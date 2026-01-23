import {
  type Browser,
  test as baseTest,
  type Fixtures,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightWorkerArgs,
} from "@playwright/test";

export type { Page, Route } from "@playwright/test";
export { expect, request } from "@playwright/test";

export function getBaseURL(): string {
  const url = process.env.E2E_BASE_URL;

  if (!url) {
    throw new Error("E2E_BASE_URL not set. Is the webServer running?");
  }

  console.info(`[E2E] Running on ${url}`);

  return url;
}

export type AuthFixtures = {
  authenticatedPage: Page;
  logoutPage: Page;
  userWithoutProgress: Page;
};

export type StorageStateConfig = {
  authDir: string;
  files: {
    authenticatedPage: string;
    logoutPage: string;
    userWithoutProgress: string;
  };
};

/**
 * Create auth fixtures using pre-generated storage state files.
 * Apps should generate storage states in their global-setup.ts.
 */
export function createStorageStateFixtures(
  config: StorageStateConfig,
): Fixtures<AuthFixtures, object, PlaywrightTestArgs, PlaywrightWorkerArgs> {
  return {
    authenticatedPage: async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: `${config.authDir}/${config.files.authenticatedPage}`,
      });
      const page = await context.newPage();
      await use(page);
      await context.close();
    },
    logoutPage: async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: `${config.authDir}/${config.files.logoutPage}`,
      });
      const page = await context.newPage();
      await use(page);
      await context.close();
    },
    userWithoutProgress: async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: `${config.authDir}/${config.files.userWithoutProgress}`,
      });
      const page = await context.newPage();
      await use(page);
      await context.close();
    },
  };
}

/**
 * Create a single auth fixture for a storage state file.
 * Use this to reduce boilerplate when defining multiple user fixtures.
 */
export function createAuthFixture(storageState: string) {
  return async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  };
}

// Extend test with dynamic baseURL from captured webServer port
export const test = baseTest.extend({
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  baseURL: async ({}, use) => {
    const url = process.env.E2E_BASE_URL;

    if (!url) {
      throw new Error("E2E_BASE_URL not set. Is the webServer running?");
    }

    await use(url);
  },
});
