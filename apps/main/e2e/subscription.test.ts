import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";

test.describe("Subscription Page - Unauthenticated", () => {
  test("shows login prompt with link to login page", async ({ page }) => {
    await page.goto("/subscription");
    await expect(
      page.getByRole("alert").filter({ hasText: /logged in/i }),
    ).toBeVisible();

    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});

test.describe("Subscription Page - No Subscription", () => {
  test("shows upgrade content", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(
      authenticatedPage.getByRole("heading", {
        level: 1,
        name: /subscription/i,
      }),
    ).toBeVisible();

    // Wait for content to load (skeleton disappears)
    await expect(
      authenticatedPage.getByRole("button", { name: /upgrade/i }),
    ).toBeVisible();
  });

  test("upgrade button shows loading state when clicked", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/subscription");

    const upgradeButton = authenticatedPage.getByRole("button", {
      name: /upgrade/i,
    });

    await upgradeButton.click();

    await expect(upgradeButton).toBeDisabled();
  });
});

test.describe("Subscription Page - With Subscription", () => {
  const TestUserEmail = "e2e-new@zoonk.test";

  async function createTestSubscription() {
    const uniqueId = randomUUID();

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TestUserEmail },
    });

    const subscription = await prisma.subscription.create({
      data: {
        plan: "hobby",
        referenceId: String(user.id),
        status: "active",
        stripeCustomerId: `cus_test_e2e_${uniqueId}`,
        stripeSubscriptionId: `sub_test_e2e_${uniqueId}`,
      },
    });

    return subscription;
  }

  test("manage button shows loading state when clicked", async ({
    userWithoutProgress,
  }) => {
    const subscription = await createTestSubscription();

    try {
      await userWithoutProgress.goto("/subscription");

      await expect(
        userWithoutProgress.getByText(/your subscription is active/i),
      ).toBeVisible();

      const manageButton = userWithoutProgress.getByRole("button", {
        name: /manage subscription/i,
      });

      await manageButton.click();
      await expect(manageButton).toBeDisabled();
    } finally {
      await prisma.subscription.delete({ where: { id: subscription.id } });
    }
  });
});
