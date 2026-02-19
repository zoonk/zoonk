import { type Page, test as base } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { type E2EUser, createE2EUser, getBaseURL } from "@zoonk/e2e/helpers";

export const test = base.extend<
  {
    authenticatedPage: Page;
    memberPage: Page;
    multiOrgPage: Page;
    ownerPage: Page;
    userWithoutOrg: Page;
  },
  {
    adminUser: E2EUser;
    memberUser: E2EUser;
    multiOrgUser: E2EUser;
    noOrgUser: E2EUser;
    ownerUser: E2EUser;
  }
>({
  // Worker-scoped: each parallel worker gets unique users
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  adminUser: [
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), {
        orgRole: "admin",
        withSubscription: true,
      });
      await use(user);
    },
    { scope: "worker" },
  ],

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  memberUser: [
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), { orgRole: "member" });
      await use(user);
    },
    { scope: "worker" },
  ],

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  ownerUser: [
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), {
        orgRole: "owner",
        withSubscription: true,
      });
      await use(user);
    },
    { scope: "worker" },
  ],

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  multiOrgUser: [
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), {
        orgRole: "admin",
        withSubscription: true,
      });

      const testOrg = await prisma.organization.findUniqueOrThrow({
        where: { slug: "test-org" },
      });

      await prisma.member.create({
        data: {
          organizationId: testOrg.id,
          role: "owner",
          userId: user.id,
        },
      });

      await use(user);
    },
    { scope: "worker" },
  ],

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  noOrgUser: [
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL());
      await use(user);
    },
    { scope: "worker" },
  ],

  // Set baseURL from captured web server port so page.goto("/path") works
  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  baseURL: async ({}, use) => {
    await use(getBaseURL());
  },

  // Test-scoped: fresh browser context per test
  authenticatedPage: async ({ browser, adminUser }, use) => {
    const ctx = await browser.newContext({
      storageState: adminUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  memberPage: async ({ browser, memberUser }, use) => {
    const ctx = await browser.newContext({
      storageState: memberUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  ownerPage: async ({ browser, ownerUser }, use) => {
    const ctx = await browser.newContext({
      storageState: ownerUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  multiOrgPage: async ({ browser, multiOrgUser }, use) => {
    const ctx = await browser.newContext({
      storageState: multiOrgUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  userWithoutOrg: async ({ browser, noOrgUser }, use) => {
    const ctx = await browser.newContext({
      storageState: noOrgUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";
