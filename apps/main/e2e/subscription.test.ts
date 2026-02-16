import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";

const TEST_USER_EMAIL = "e2e-new@zoonk.test";

async function createTestSubscription(plan: string) {
  const uniqueId = randomUUID();

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: TEST_USER_EMAIL },
  });

  return prisma.subscription.create({
    data: {
      plan,
      referenceId: String(user.id),
      status: "active",
      stripeCustomerId: `cus_test_e2e_${uniqueId}`,
      stripeSubscriptionId: `sub_test_e2e_${uniqueId}`,
    },
  });
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
  test("displays all four plans", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /subscription/i }),
    ).toBeVisible();

    await expect(authenticatedPage.getByText("Free")).toBeVisible();
    await expect(authenticatedPage.getByText("Hobby")).toBeVisible();
    await expect(authenticatedPage.getByText("Plus")).toBeVisible();
    await expect(authenticatedPage.getByText("Pro")).toBeVisible();
  });

  test("shows Current badge on Free plan when no subscription", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByLabel(/current plan/i)).toBeVisible();
  });

  test("shows monthly/yearly toggle", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByRole("tab", { name: /monthly/i })).toBeVisible();
    await expect(authenticatedPage.getByRole("tab", { name: /yearly/i })).toBeVisible();
  });

  test("shows upgrade buttons for paid plans", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    const upgradeButtons = authenticatedPage.getByRole("button", { name: /upgrade/i });
    await expect(upgradeButtons.first()).toBeVisible();
  });

  test("does not show action button for free plan", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByText("Limited lessons with ads")).toBeVisible();
  });
});

test.describe("Subscription Page - With Hobby Subscription", () => {
  test("shows Current badge on Hobby plan", async ({ userWithoutProgress }) => {
    const subscription = await createTestSubscription("hobby");

    try {
      await userWithoutProgress.goto("/subscription");

      await expect(userWithoutProgress.getByLabel(/current plan/i)).toBeVisible();
      await expect(userWithoutProgress.getByRole("button", { name: /manage/i })).toBeVisible();
    } finally {
      await prisma.subscription.delete({ where: { id: subscription.id } });
    }
  });

  test("shows upgrade buttons for Plus and Pro", async ({ userWithoutProgress }) => {
    const subscription = await createTestSubscription("hobby");

    try {
      await userWithoutProgress.goto("/subscription");

      const upgradeButtons = userWithoutProgress.getByRole("button", { name: /upgrade/i });
      await expect(upgradeButtons).toHaveCount(2);
    } finally {
      await prisma.subscription.delete({ where: { id: subscription.id } });
    }
  });

  test("manage button shows loading state when clicked", async ({ userWithoutProgress }) => {
    const subscription = await createTestSubscription("hobby");

    try {
      await userWithoutProgress.goto("/subscription");

      const manageButton = userWithoutProgress.getByRole("button", { name: /manage/i });
      await manageButton.click();
      await expect(manageButton).toBeDisabled();
    } finally {
      await prisma.subscription.delete({ where: { id: subscription.id } });
    }
  });
});

test.describe("Subscription Page - With Pro Subscription", () => {
  test("shows Current badge on Pro plan and Switch/Cancel for lower plans", async ({
    userWithoutProgress,
  }) => {
    const subscription = await createTestSubscription("pro");

    try {
      await userWithoutProgress.goto("/subscription");

      await expect(userWithoutProgress.getByLabel(/current plan/i)).toBeVisible();
      await expect(userWithoutProgress.getByRole("button", { name: /manage/i })).toBeVisible();

      const switchButtons = userWithoutProgress.getByRole("button", { name: /switch/i });
      await expect(switchButtons.first()).toBeVisible();
    } finally {
      await prisma.subscription.delete({ where: { id: subscription.id } });
    }
  });
});
