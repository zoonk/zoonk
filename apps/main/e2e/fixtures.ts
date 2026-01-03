import { test as base, type Page } from "@zoonk/e2e/fixtures";

type AuthFixtures = {
  authenticatedPage: Page;
  logoutPage: Page;
  userWithProgress: Page;
  userWithoutProgress: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/withProgress.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  logoutPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/logout.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  userWithoutProgress: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/noProgress.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  userWithProgress: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/withProgress.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

// biome-ignore lint/performance/noBarrelFile: re-exporting for convenience
export { expect, type Page } from "@zoonk/e2e/fixtures";
export { E2E_USERS, type E2EUserKey } from "./global-setup";
