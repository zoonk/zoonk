import {
  type Browser,
  type BrowserContext,
  test as base,
  type Page,
} from "@playwright/test";

export type TestUser = {
  email: string;
  password: string;
};

export const TEST_USERS = {
  admin: { email: "admin@zoonk.test", password: "password123" },
  logoutTest: { email: "logout-test@zoonk.test", password: "password123" },
  member: { email: "member@zoonk.test", password: "password123" },
  owner: { email: "owner@zoonk.test", password: "password123" },
} as const satisfies Record<string, TestUser>;

export type TestUserKey = keyof typeof TEST_USERS;

type AuthFixtures = {
  authenticatedPage: Page;
  logoutPage: Page;
  userWithProgress: Page;
  userWithoutProgress: Page;
};

async function signIn(page: Page, user: TestUser): Promise<void> {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `Sign-in failed for ${user.email}: ${response.status()} - ${body}`,
    );
  }
}

/**
 * Create a new authenticated browser context for a custom user.
 * Useful for tests that need a specific user not covered by fixtures.
 */
export async function createAuthContext(
  browser: Browser,
  user: TestUser,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user);
  return context;
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    // Create a new isolated context for authenticated tests (member has course enrollment)
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, TEST_USERS.member);
    await use(page);
    await context.close();
  },
  logoutPage: async ({ browser }, use) => {
    // Dedicated user for logout tests to avoid session interference with parallel tests
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, TEST_USERS.logoutTest);
    await use(page);
    await context.close();
  },
  userWithoutProgress: async ({ browser }, use) => {
    // Create a new isolated context for user without course enrollment (admin has no CourseUser)
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, TEST_USERS.admin);
    await use(page);
    await context.close();
  },
  userWithProgress: async ({ browser }, use) => {
    // Create a new isolated context for user with progress (owner has most progress)
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, TEST_USERS.owner);
    await use(page);
    await context.close();
  },
});

// biome-ignore lint/performance/noBarrelFile: re-exporting for convenience
export { expect, type Page, request } from "@playwright/test";
