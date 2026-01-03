import { test as base, type Page } from "@zoonk/e2e/fixtures";

type AuthFixtures = {
  authenticatedPage: Page;
  logoutPage: Page;
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
});

export { expect, type Page } from "@zoonk/e2e/fixtures";
