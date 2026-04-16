import { randomUUID } from "node:crypto";
import { type Page, test as base } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";

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
  adminUser: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), {
        orgRole: "admin",
        withSubscription: true,
      });
      await use(user);
    },
    { scope: "worker" },
  ],

  authenticatedPage: async ({ browser, adminUser }, use) => {
    const ctx = await browser.newContext({
      storageState: adminUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
  baseURL: async ({}, use) => {
    await use(getBaseURL());
  },

  memberPage: async ({ browser, memberUser }, use) => {
    const ctx = await browser.newContext({
      storageState: memberUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  memberUser: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), { orgRole: "member" });
      await use(user);
    },
    { scope: "worker" },
  ],

  multiOrgPage: async ({ browser, multiOrgUser }, use) => {
    const ctx = await browser.newContext({
      storageState: multiOrgUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  multiOrgUser: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
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
          id: randomUUID(),
          organizationId: testOrg.id,
          role: "owner",
          userId: user.id,
        },
      });

      await use(user);
    },
    { scope: "worker" },
  ],

  noOrgUser: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL());
      await use(user);
    },
    { scope: "worker" },
  ],

  ownerPage: async ({ browser, ownerUser }, use) => {
    const ctx = await browser.newContext({
      storageState: ownerUser.storageState,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  ownerUser: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Playwright requires destructuring pattern
    async ({}, use) => {
      const user = await createE2EUser(getBaseURL(), {
        orgRole: "owner",
        withSubscription: true,
      });
      await use(user);
    },
    { scope: "worker" },
  ],

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
