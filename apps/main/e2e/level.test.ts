import { expect, test } from "./fixtures";

test.describe("Level Page", () => {
  test.describe("Unauthenticated Users", () => {
    test("shows login prompt with link to login page", async ({ page }) => {
      await page.goto("/level");

      await expect(
        page.getByText(/log in to track your progress/i),
      ).toBeVisible();

      await expect(page.getByRole("link", { name: /login/i })).toHaveAttribute(
        "href",
        "/login",
      );
    });
  });

  test.describe("Authenticated Users", () => {
    test("navigates from home and sees level details with comparison", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/");

      // Wait for Performance section to load (indicates Suspense resolved)
      await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();

      // User clicks level card on home page (use flexible matcher for belt name)
      await authenticatedPage
        .getByRole("link")
        .filter({
          has: authenticatedPage.getByText(/belt - level \d+/i),
        })
        .click();

      await expect(authenticatedPage).toHaveURL(/\/level/);

      await expect(
        authenticatedPage.getByRole("heading", {
          level: 1,
          name: /^level$/i,
        }),
      ).toBeVisible();

      await expect(authenticatedPage.getByText(/vs last month/i)).toBeVisible();
    });

    test("displays total BP and current belt level", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/level");

      await expect(
        authenticatedPage.getByText(/total brain power/i).first(),
      ).toBeVisible();

      await expect(authenticatedPage.getByText(/bp/i).first()).toBeVisible();

      await expect(
        authenticatedPage.getByText(/orange belt - level/i),
      ).toBeVisible();

      await expect(
        authenticatedPage.getByText(/bp to next level/i),
      ).toBeVisible();
    });

    test("displays belt progression visualization", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/level");

      await expect(
        authenticatedPage.getByText(/belt progression/i),
      ).toBeVisible();

      await expect(authenticatedPage.getByRole("progressbar")).toBeVisible();
    });

    test("switching to 6 months shows different comparison text", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/level");

      await expect(authenticatedPage.getByText(/vs last month/i)).toBeVisible();

      await authenticatedPage
        .getByRole("button", { name: /6 months/i })
        .click();

      await expect(
        authenticatedPage.getByText(/vs last 6 months/i),
      ).toBeVisible();

      await expect(
        authenticatedPage.getByText(/vs last month/i),
      ).not.toBeVisible();
    });

    test("switching to year shows different comparison text", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/level");

      await authenticatedPage.getByRole("button", { name: /year/i }).click();

      await expect(authenticatedPage.getByText(/vs last year/i)).toBeVisible();

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
      await authenticatedPage.goto("/level");

      await expect(authenticatedPage.getByText(/vs last month/i)).toBeVisible();

      const prevButton = authenticatedPage.getByRole("button", {
        name: /previous period/i,
      });

      await prevButton.click();
      await authenticatedPage.waitForURL(/offset=1/);

      await authenticatedPage
        .getByRole("button", { name: /6 months/i })
        .click();

      await expect(authenticatedPage).not.toHaveURL(/offset=1/);

      await expect(
        authenticatedPage.getByText(/vs last 6 months/i),
      ).toBeVisible();
    });
  });

  test.describe("Users Without Progress", () => {
    test("sees prompt to start learning", async ({ userWithoutProgress }) => {
      await userWithoutProgress.goto("/level");

      await expect(
        userWithoutProgress.getByText(/start learning to track your progress/i),
      ).toBeVisible();
    });
  });
});
