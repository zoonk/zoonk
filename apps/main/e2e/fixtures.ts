import { type Page, test as base } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";
import { resetGuestSpend } from "@zoonk/testing/fixtures/usage";
import { mockCentralSignOut } from "./auth-transport";

// Each test needs its own user: lesson completions and subscriptions persist beyond browser contexts.
export const test = base.extend<{
  authenticatedPage: Page;
  closeOpenedContexts: null;
  guestBudget: null;
  logoutPage: Page;
  noProgressUser: E2EUser;
  subscriberPage: Page;
  subscriberUser: E2EUser;
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

  /**
   * Closes the browser contexts a test opened (`openAs` and the like) once it ends, so their pages
   * stop prefetching and polling while the worker's later tests run.
   */
  closeOpenedContexts: [
    async ({ browser }, use) => {
      const before = new Set(browser.contexts());
      await use(null);
      const opened = browser.contexts().filter((context) => !before.has(context));
      await Promise.all(opened.map((context) => context.close()));
    },
    { auto: true },
  ],

  /**
   * A run's guests start goals (each weighs about $1.80 in core's limits), which would use up the
   * day's AI budget all guests share and refuse later tests' guests: each test starts with that
   * budget untouched. Core's own tests cover the budget itself.
   */
  guestBudget: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
    async ({}, use) => {
      await resetGuestSpend();
      await use(null);
    },
    { auto: true },
  ],

  logoutPage: async ({ browser }, use) => {
    const logoutUser = await createE2EUser(getBaseURL());
    const ctx = await browser.newContext({ storageState: logoutUser.storageState });
    const page = await ctx.newPage();
    await mockCentralSignOut(page);
    await use(page);
    await ctx.close();
  },

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  noProgressUser: async ({}, use) => {
    const user = await createE2EUser(getBaseURL(), { orgRole: "member" });
    await use(user);
  },

  subscriberPage: async ({ browser, subscriberUser }, use) => {
    const ctx = await browser.newContext({ storageState: subscriberUser.storageState });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  subscriberUser: async ({}, use) => {
    const user = await createE2EUser(getBaseURL(), {
      orgRole: "member",
      withProgress: true,
      withSubscription: true,
    });

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
