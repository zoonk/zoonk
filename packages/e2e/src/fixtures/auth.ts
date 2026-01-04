import type {
  Browser,
  BrowserContext,
  Fixtures,
  Page,
  PlaywrightTestArgs,
  PlaywrightWorkerArgs,
} from "@playwright/test";

export type TestUser = {
  email: string;
  password: string;
};

export type StorageStateConfig = {
  authDir: string;
  files: {
    authenticatedPage: string;
    logoutPage: string;
    userWithoutProgress: string;
  };
};

export async function signIn(page: Page, user: TestUser): Promise<void> {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `Sign-in failed for ${user.email}: ${response.status()} - ${body}`,
    );
  }
}

/**
 * Create a new authenticated browser context for a custom user.
 * Useful for tests that need a specific user not covered by fixtures.
 */
export async function createAuthContext(
  browser: Browser,
  user: TestUser,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user);
  return context;
}

export type AuthFixtures = {
  authenticatedPage: Page;
  logoutPage: Page;
  userWithoutProgress: Page;
};

/**
 * Create auth fixtures using pre-generated storage state files.
 * This is faster than API sign-in (~5ms vs ~100ms per test).
 *
 * Apps should generate storage states in their global-setup.ts using signIn().
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

export { expect, type Page, request, test } from "@playwright/test";
