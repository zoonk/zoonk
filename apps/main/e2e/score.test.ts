import { expect, test } from "./fixtures";

test.describe("Score Page", () => {
  test.describe("Unauthenticated Users", () => {
    test("shows login prompt with link to login page", async ({ page }) => {
      await page.goto("/score");

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
    test("navigates to score page and sees score details", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/score");

      // User sees the score page heading
      await expect(
        authenticatedPage.getByRole("heading", { name: /^score$/i }),
      ).toBeVisible();

      // User sees comparison to previous month (proves dynamic data loaded)
      await expect(authenticatedPage.getByText(/vs last month/i)).toBeVisible();
    });

    test("sees best day and best time insights", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/score");

      await expect(
        authenticatedPage.getByRole("heading", { name: /best day/i }),
      ).toBeVisible();

      await expect(
        authenticatedPage.getByRole("heading", { name: /best time/i }),
      ).toBeVisible();
    });

    test("switching to 6 months shows different comparison text", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/score");

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
      await authenticatedPage.goto("/score");

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
      await authenticatedPage.goto("/score");

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

    test("displays score explanation section", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/score");

      // User sees the explanation about score
      await expect(authenticatedPage.getByText(/about score/i)).toBeVisible();

      // User sees the explanation text
      await expect(
        authenticatedPage.getByText(
          /percentage of questions you answered correctly/i,
        ),
      ).toBeVisible();
    });
  });

  test.describe("Users Without Progress", () => {
    test("sees prompt to start learning", async ({ userWithoutProgress }) => {
      await userWithoutProgress.goto("/score");

      await expect(
        userWithoutProgress.getByText(/start learning to track your progress/i),
      ).toBeVisible();
    });
  });
});
