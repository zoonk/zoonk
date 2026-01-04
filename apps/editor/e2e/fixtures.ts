import type { Page } from "@zoonk/e2e/fixtures";
import { test as base } from "@zoonk/e2e/fixtures";

export type EditorAuthFixtures = {
  authenticatedPage: Page;
  memberPage: Page;
  multiOrgPage: Page;
  ownerPage: Page;
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
  memberPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/member.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  multiOrgPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/multiOrg.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  ownerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/owner.json",
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
