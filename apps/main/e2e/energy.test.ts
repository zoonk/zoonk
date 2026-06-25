import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { getProgressInsightDateLabel } from "../src/app/(progress)/_components/progress-insight-date-label";
import { expect, test } from "./fixtures";

test.describe("Energy Page", () => {
  test.describe("Unauthenticated Users", () => {
    test("shows login prompt with link to login page", async ({ page }) => {
      await page.goto("/energy");

      // User sees prompt to log in
      await expect(page.getByText(/log in to track your progress/iu)).toBeVisible();

      // Login link points to correct destination
      await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
    });
  });

  test.describe("Authenticated Users", () => {
    test("navigates from home and sees energy details with comparison", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/");

      // Wait for Progress section to load (indicates Suspense resolved)
      await expect(authenticatedPage.getByText(/^progress$/iu)).toBeVisible();

      // User clicks energy card on home page (use flexible matcher for energy percentage)
      await authenticatedPage
        .getByRole("link")
        .filter({ has: authenticatedPage.getByText(/your energy is \d+(?:\.\d+)?%/iu) })
        .click();

      // Wait for navigation to energy page
      await expect(authenticatedPage).toHaveURL(/\/energy/u);

      // User sees the energy page heading
      await expect(authenticatedPage.getByRole("heading", { name: /^energy$/iu })).toBeVisible();

      // User sees comparison to previous month (proves dynamic data loaded)
      await expect(authenticatedPage.getByText(/vs last month/iu)).toBeVisible();
    });

    test("displays current energy and selected-period average", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/energy");

      await expect(authenticatedPage.getByText(/current energy/iu)).toBeVisible();
      await expect(authenticatedPage.getByText(/% average/iu)).toBeVisible();
    });

    test("displays current-month energy insight values", async ({ baseURL, browser }) => {
      const user = await createE2EUser(baseURL!, { orgRole: "member", withProgress: true });
      const browserContext = await browser.newContext({ storageState: user.storageState });
      const page = await browserContext.newPage();

      try {
        await page.goto("/energy");

        const highestEnergyCard = page.getByRole("article", { name: /highest energy day/iu });
        const fullEnergyCard = page.getByRole("article", { name: /full energy/iu });
        const todayLabel = getProgressInsightDateLabel({ date: new Date(), locale: "en" });

        await expect(highestEnergyCard).toContainText(`${todayLabel} with 100%`);
        await expect(highestEnergyCard).toContainText("This month");
        await expect(fullEnergyCard).toContainText("1 day");
        await expect(fullEnergyCard).toContainText("This month");
      } finally {
        await browserContext.close();
      }
    });

    test("switching to 6 months shows different comparison text", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/energy");

      // Verify we start with month comparison
      await expect(authenticatedPage.getByText(/vs last month/iu)).toBeVisible();

      // Switch to 6 months
      await authenticatedPage.getByRole("button", { name: /6 months/iu }).click();

      // Comparison text changes to reference 6 months
      await expect(authenticatedPage.getByText(/vs last 6 months/iu)).toBeVisible();

      // The month comparison should no longer be visible
      await expect(authenticatedPage.getByText(/vs last month/iu)).not.toBeVisible();
    });

    test("switching to year shows different comparison text", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/energy");

      // Switch directly to year
      await authenticatedPage.getByRole("button", { name: /year/iu }).click();

      // Comparison text references year
      await expect(authenticatedPage.getByText(/vs last year/iu)).toBeVisible();

      // Other comparison texts should not be visible
      await expect(authenticatedPage.getByText(/vs last month/iu)).not.toBeVisible();
      await expect(authenticatedPage.getByText(/vs last 6 months/iu)).not.toBeVisible();
    });

    test("switching to all hides comparison text", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/energy");

      // Verify we start with month comparison
      await expect(authenticatedPage.getByText(/vs last month/iu)).toBeVisible();

      // Switch to all
      await authenticatedPage.getByRole("button", { name: /^all$/iu }).click();

      // No comparison text should be visible
      await expect(authenticatedPage.getByText(/vs last month/iu)).not.toBeVisible();
      await expect(authenticatedPage.getByText(/vs last 6 months/iu)).not.toBeVisible();
      await expect(authenticatedPage.getByText(/vs last year/iu)).not.toBeVisible();

      // Page still shows data
      await expect(authenticatedPage.getByRole("heading", { name: /^energy$/iu })).toBeVisible();
    });

    test("resets offset when switching periods", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/energy");

      // Verify we see the comparison initially
      await expect(authenticatedPage.getByText(/vs last month/iu)).toBeVisible();

      // Navigate back in time by clicking previous period
      const prevButton = authenticatedPage.getByRole("button", { name: /previous period/iu });

      await prevButton.click();
      await authenticatedPage.waitForURL(/offset=1/u);

      // Now switch to "6 Months" - should reset offset and show data
      await authenticatedPage.getByRole("button", { name: /6 months/iu }).click();

      // URL should not contain offset anymore (or should be reset to 0)
      await expect(authenticatedPage).not.toHaveURL(/offset=1/u);

      // Should see the comparison for 6 months (not "Start learning" message)
      await expect(authenticatedPage.getByText(/vs last 6 months/iu)).toBeVisible();

      // Should NOT see the "start learning" prompt
      await expect(
        authenticatedPage.getByText(/start learning to track your progress/iu),
      ).not.toBeVisible();
    });

    test("displays energy explanation sections", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/energy");

      await expect(
        authenticatedPage.getByRole("heading", { name: /what is energy/iu }),
      ).toBeVisible();

      await expect(
        authenticatedPage.getByRole("heading", { name: /how do i improve energy/iu }),
      ).toBeVisible();

      await expect(
        authenticatedPage.getByRole("heading", { name: /why is energy important/iu }),
      ).toBeVisible();

      await expect(authenticatedPage.getByText(/doesn't reset your progress/iu)).toBeVisible();
    });
  });

  test.describe("Users Without Progress", () => {
    test("sees prompt to start learning", async ({ userWithoutProgress }) => {
      await userWithoutProgress.goto("/energy");

      await expect(
        userWithoutProgress.getByText(/start learning to track your progress/iu),
      ).toBeVisible();
    });
  });
});
