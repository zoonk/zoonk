import { type Page, test as base } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";

export const test = base.extend<{
  authenticatedPage: Page;
  logoutPage: Page;
  noProgressUser: E2EUser;
  userWithoutProgress: Page;
  withProgressUser: E2EUser;
}>({
  authenticatedPage: async ({ browser, withProgressUser }, use) => {
    const ctx = await browser.newContext({ storageState: withProgressUser.storageState });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  baseURL: async ({}, use) => {
    await use(getBaseURL());
  },

  logoutPage: async ({ browser }, use) => {
    const logoutUser = await createE2EUser(getBaseURL());
    const ctx = await browser.newContext({ storageState: logoutUser.storageState });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  noProgressUser: async ({}, use) => {
    const user = await createE2EUser(getBaseURL(), { orgRole: "member" });
    await use(user);
  },

  userWithoutProgress: async ({ browser, noProgressUser }, use) => {
    const ctx = await browser.newContext({ storageState: noProgressUser.storageState });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  withProgressUser: async ({}, use) => {
    const user = await createE2EUser(getBaseURL(), { orgRole: "member", withProgress: true });
    await use(user);
  },
});

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";
