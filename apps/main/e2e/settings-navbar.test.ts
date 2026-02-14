import { expect, test } from "./fixtures";

test.describe("Settings Navbar", () => {
  test("home link navigates to home page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("link", { name: /home page/i }).click();

    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();
  });

  test("displays all settings navigation pills", async ({ page }) => {
    await page.goto("/subscription");

    await expect(page.getByRole("link", { name: /subscription/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /language/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /profile/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /support/i })).toBeVisible();
  });

  test("Subscription pill navigates to subscription page", async ({ page }) => {
    await page.goto("/language");
    await page.getByRole("link", { name: /subscription/i }).click();

    await expect(page.getByRole("heading", { level: 1, name: /subscription/i })).toBeVisible();
  });

  test("Language pill navigates to language page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("link", { name: /language/i }).click();

    await expect(page.getByRole("heading", { level: 1, name: /language/i })).toBeVisible();
  });

  test("Profile pill navigates to profile page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("link", { name: /profile/i }).click();

    await expect(page.getByRole("heading", { level: 1, name: /profile/i })).toBeVisible();
  });

  test("Support pill navigates to support page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("link", { name: /support/i }).click();

    await expect(page.getByRole("heading", { level: 1, name: /help.*support/i })).toBeVisible();
  });

  test("logout button logs user out", async ({ logoutPage }) => {
    await logoutPage.goto("/subscription");

    await expect(logoutPage.getByRole("link", { name: /logout/i })).toBeVisible();

    await Promise.all([
      logoutPage.waitForURL(/^[^?]*\/$/),
      logoutPage.waitForResponse(
        (response) => response.url().includes("/api/auth/get-session") && response.status() === 200,
      ),
      logoutPage.getByRole("link", { name: /logout/i }).click(),
    ]);

    // Scope to navigation to avoid strict mode violation
    await logoutPage
      .getByRole("navigation")
      .getByRole("button", { name: /search/i })
      .click();

    await expect(logoutPage.getByRole("dialog").getByText(/^login$/i)).toBeVisible();
  });
});
