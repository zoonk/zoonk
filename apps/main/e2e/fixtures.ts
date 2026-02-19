import { type Page, test as base } from "@playwright/test";
import { type E2EUser, createE2EUser, getBaseURL } from "@zoonk/e2e/helpers";

export const test = base.extend<
  {
    authenticatedPage: Page;
    logoutPage: Page;
    userWithoutProgress: Page;
  },
  {
    logoutUser: E2EUser;
    noProgressUser: E2EUser;
    withProgressUser: E2EUser;
  }
>({
  authenticatedPage: async ({ browser, withProgressUser }, use) => {
    const ctx = await browser.newContext({
      storageState: withProgressUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  baseURL: async ({}, use) => {
    await use(getBaseURL());
  },

  logoutPage: async ({ browser, logoutUser }, use) => {
    const ctx = await browser.newContext({
      storageState: logoutUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  logoutUser: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL());
      await use(user);
    },
    { scope: "worker" },
  ],

  noProgressUser: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), { orgRole: "member" });
      await use(user);
    },
    { scope: "worker" },
  ],

  userWithoutProgress: async ({ browser, noProgressUser }, use) => {
    const ctx = await browser.newContext({
      storageState: noProgressUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  withProgressUser: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), {
        orgRole: "member",
        withProgress: true,
      });
      await use(user);
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";
