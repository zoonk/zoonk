import { test as base, type Page } from "@playwright/test";

type TestUser = {
  email: string;
  password: string;
};

export const TEST_USERS = {
  admin: { email: "admin@zoonk.test", password: "password123" },
  member: { email: "member@zoonk.test", password: "password123" },
  owner: { email: "owner@zoonk.test", password: "password123" },
} as const satisfies Record<string, TestUser>;

type AuthFixtures = {
  authenticatedPage: Page;
  userWithProgress: Page;
};

async function signIn(page: Page, user: TestUser): Promise<void> {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to sign in as ${user.email}: ${response.status()}`);
  }
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await signIn(page, TEST_USERS.member);
    await use(page);
  },
  userWithProgress: async ({ page }, use) => {
    await signIn(page, TEST_USERS.owner);
    await use(page);
  },
});

// biome-ignore lint/performance/noBarrelFile: re-exporting for convenience
export { expect } from "@playwright/test";
