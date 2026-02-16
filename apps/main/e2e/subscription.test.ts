import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { request } from "@zoonk/e2e/fixtures";
import { expect, test } from "./fixtures";

async function createUserWithSubscription(baseURL: string, plan: string) {
  const uniqueId = randomUUID().slice(0, 8);
  const email = `e2e-sub-${uniqueId}@zoonk.test`;
  const password = "password123";

  const signupContext = await request.newContext({ baseURL });
  const signupResponse = await signupContext.post("/api/auth/sign-up/email", {
    data: { email, name: `E2E Sub ${uniqueId}`, password },
  });

  expect(signupResponse.ok()).toBe(true);
  await signupContext.dispose();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  await prisma.subscription.create({
    data: {
      plan,
      referenceId: String(user.id),
      status: "active",
      stripeCustomerId: `cus_test_e2e_${uniqueId}`,
      stripeSubscriptionId: `sub_test_e2e_${uniqueId}`,
    },
  });

  return email;
}

async function createAuthenticatedPage(browser: Browser, baseURL: string, email: string) {
  const context = await request.newContext({ baseURL });

  await context.post("/api/auth/sign-in/email", {
    data: { email, password: "password123" },
  });

  const storageState = await context.storageState();
  await context.dispose();

  const browserContext = await browser.newContext({ storageState });
  const page = await browserContext.newPage();

  return { browserContext, page };
}

test.describe("Subscription Page - Unauthenticated", () => {
  test("shows login prompt with link to login page", async ({ page }) => {
    await page.goto("/subscription");
    await expect(page.getByRole("alert").filter({ hasText: /logged in/i })).toBeVisible();

    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});

test.describe("Subscription Page - No Subscription", () => {
  test("displays all four plans as radio options", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /subscription/i }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("radio", { name: /free/i })).toBeVisible();
    await expect(authenticatedPage.getByRole("radio", { name: /hobby/i })).toBeVisible();
    await expect(authenticatedPage.getByRole("radio", { name: /plus/i })).toBeVisible();
    await expect(authenticatedPage.getByRole("radio", { name: /pro/i })).toBeVisible();
  });

  test("has Free plan selected by default when no subscription", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByRole("radio", { name: /free/i })).toBeChecked();
    await expect(authenticatedPage.getByLabel(/current plan/i)).toBeVisible();
  });

  test("shows monthly/yearly toggle", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByRole("tab", { name: /monthly/i })).toBeVisible();
    await expect(authenticatedPage.getByRole("tab", { name: /yearly/i })).toBeVisible();
  });

  test("shows Manage button when current plan is selected", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByRole("button", { name: /manage/i })).toBeVisible();
  });

  test("shows Upgrade button when selecting a paid plan", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await authenticatedPage.getByRole("radio", { name: /hobby/i }).click();
    await expect(
      authenticatedPage.getByRole("button", { name: /upgrade to hobby/i }),
    ).toBeVisible();
  });

  test("changes CTA label when selecting different plans", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await authenticatedPage.getByRole("radio", { name: /pro/i }).click();
    await expect(authenticatedPage.getByRole("button", { name: /upgrade to pro/i })).toBeVisible();

    await authenticatedPage.getByRole("radio", { name: /free/i }).click();
    await expect(authenticatedPage.getByRole("button", { name: /manage/i })).toBeVisible();
  });
});

test.describe("Subscription Page - With Hobby Subscription", () => {
  test("has current plan selected by default and shows Current badge", async ({
    browser,
    baseURL,
  }) => {
    const email = await createUserWithSubscription(baseURL!, "hobby");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByRole("radio", { name: /hobby/i })).toBeChecked();
    await expect(page.getByLabel(/current plan/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /manage/i })).toBeVisible();

    await browserContext.close();
  });

  test("shows Upgrade when selecting a higher plan", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "hobby");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await page.getByRole("radio", { name: /plus/i }).click();
    await expect(page.getByRole("button", { name: /upgrade to plus/i })).toBeVisible();

    await browserContext.close();
  });

  test("shows Cancel when selecting Free plan", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "hobby");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await page.getByRole("radio", { name: /free/i }).click();
    await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();

    await browserContext.close();
  });

  test("CTA button shows loading state when clicked", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "hobby");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    const manageButton = page.getByRole("button", { name: /manage/i });
    await manageButton.click();
    await expect(manageButton).toBeDisabled();

    await browserContext.close();
  });
});

test.describe("Subscription Page - With Pro Subscription", () => {
  test("shows Switch to for lower paid plans and Cancel for Free", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "pro");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByRole("radio", { name: /pro/i })).toBeChecked();
    await expect(page.getByLabel(/current plan/i)).toBeVisible();

    await page.getByRole("radio", { name: /hobby/i }).click();
    await expect(page.getByRole("button", { name: /switch to hobby/i })).toBeVisible();

    await page.getByRole("radio", { name: /free/i }).click();
    await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();

    await browserContext.close();
  });
});
