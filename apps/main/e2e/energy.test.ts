import { expect, test } from "./fixtures";

test.describe("Energy Page", () => {
  test.describe("Unauthenticated Users", () => {
    test("shows login prompt with link to login page", async ({ page }) => {
      await page.goto("/energy");

      // User sees prompt to log in
      await expect(
        page.getByText(/log in to track your progress/i),
      ).toBeVisible();

      // Login link points to correct destination
      await expect(page.getByRole("link", { name: /login/i })).toHaveAttribute(
        "href",
        "/login",
      );
    });
  });

  test.describe("Authenticated Users", () => {
    test("navigates from home and sees energy details with comparison", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/");

      // Wait for Performance section to load (indicates Suspense resolved)
      await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();

      // User clicks energy card on home page (use flexible matcher for energy percentage)
      await authenticatedPage
        .getByRole("link")
        .filter({
          has: authenticatedPage.getByText(/your energy is \d+%/i),
        })
        .click();

      // Wait for navigation to energy page
      await expect(authenticatedPage).toHaveURL(/\/energy/);

      // User sees the energy page heading
      await expect(
        authenticatedPage.getByRole("heading", { name: /^energy$/i }),
      ).toBeVisible();

      // User sees comparison to previous month (proves dynamic data loaded)
      await expect(authenticatedPage.getByText(/vs last month/i)).toBeVisible();
    });

    test("switching to 6 months shows different comparison text", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/energy");

      // Verify we start with month comparison
      await expect(authenticatedPage.getByText(/vs last month/i)).toBeVisible();

      // Switch to 6 months
      await authenticatedPage
        .getByRole("button", { name: /6 months/i })
        .click();

      // Comparison text changes to reference 6 months
      await expect(
        authenticatedPage.getByText(/vs last 6 months/i),
      ).toBeVisible();

      // The month comparison should no longer be visible
      await expect(
        authenticatedPage.getByText(/vs last month/i),
      ).not.toBeVisible();
    });

    test("switching to year shows different comparison text", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/energy");

      // Switch directly to year
      await authenticatedPage.getByRole("button", { name: /year/i }).click();

      // Comparison text references year
      await expect(authenticatedPage.getByText(/vs last year/i)).toBeVisible();

      // Other comparison texts should not be visible
      await expect(
        authenticatedPage.getByText(/vs last month/i),
      ).not.toBeVisible();
      await expect(
        authenticatedPage.getByText(/vs last 6 months/i),
      ).not.toBeVisible();
    });

    test("resets offset when switching periods", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/energy");

      // Verify we see the comparison initially
      await expect(authenticatedPage.getByText(/vs last month/i)).toBeVisible();

      // Navigate back in time by clicking previous period
      const prevButton = authenticatedPage.getByRole("button", {
        name: /previous period/i,
      });

      await prevButton.click();
      await authenticatedPage.waitForURL(/offset=1/);

      // Now switch to "6 Months" - should reset offset and show data
      await authenticatedPage
        .getByRole("button", { name: /6 months/i })
        .click();

      // URL should not contain offset anymore (or should be reset to 0)
      await expect(authenticatedPage).not.toHaveURL(/offset=1/);

      // Should see the comparison for 6 months (not "Start learning" message)
      await expect(
        authenticatedPage.getByText(/vs last 6 months/i),
      ).toBeVisible();

      // Should NOT see the "start learning" prompt
      await expect(
        authenticatedPage.getByText(/start learning to track your progress/i),
      ).not.toBeVisible();
    });
  });

  test.describe("Users Without Progress", () => {
    test("sees prompt to start learning", async ({ userWithoutProgress }) => {
      await userWithoutProgress.goto("/energy");

      await expect(
        userWithoutProgress.getByText(/start learning to track your progress/i),
      ).toBeVisible();
    });
  });
});
