import type { Page } from "@zoonk/e2e/fixtures";
import { test as base } from "@zoonk/e2e/fixtures";

export type EditorAuthFixtures = {
  authenticatedPage: Page;
  userWithoutOrg: Page;
};

export const test = base.extend<EditorAuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  userWithoutOrg: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/noOrg.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect, type Page } from "@zoonk/e2e/fixtures";
