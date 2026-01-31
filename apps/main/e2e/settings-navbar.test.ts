import { expect, test } from "./fixtures";

test.describe("Settings Navbar", () => {
  test("home link navigates to home page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /home page/i }).click();

    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();
  });

  test("dropdown Settings item navigates to settings page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("button", { name: /subscription/i }).click();

    // Wait for dropdown animation to complete before clicking
    const settingsItem = page.getByRole("menuitem", { name: /^settings$/i });
    await expect(settingsItem).toBeVisible();
    await settingsItem.click({ force: true });

    await expect(page.getByRole("heading", { level: 1, name: /settings/i })).toBeVisible();
  });

  test("dropdown Subscription item navigates to subscription page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /settings/i }).click();

    // Wait for dropdown animation to complete before clicking
    const subscriptionItem = page.getByRole("menuitem", {
      name: /subscription/i,
    });
    await expect(subscriptionItem).toBeVisible();
    await subscriptionItem.click({ force: true });

    await expect(page.getByRole("heading", { level: 1, name: /subscription/i })).toBeVisible();
  });

  test("dropdown Language item navigates to language page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /settings/i }).click();

    // Wait for dropdown animation to complete before clicking
    const languageItem = page.getByRole("menuitem", { name: /language/i });
    await expect(languageItem).toBeVisible();
    await languageItem.click({ force: true });

    await expect(page.getByRole("heading", { level: 1, name: /language/i })).toBeVisible();
  });

  test("dropdown Display name item navigates to name page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /settings/i }).click();

    // Wait for dropdown animation to complete before clicking
    const displayNameItem = page.getByRole("menuitem", {
      name: /display name/i,
    });
    await expect(displayNameItem).toBeVisible();
    await displayNameItem.click({ force: true });

    await expect(page.getByRole("heading", { level: 1, name: /display name/i })).toBeVisible();
  });

  test("dropdown Support item navigates to support page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /settings/i }).click();

    // Wait for dropdown animation to complete before clicking
    const supportItem = page.getByRole("menuitem", { name: /support/i });
    await expect(supportItem).toBeVisible();
    await supportItem.click({ force: true });

    await expect(page.getByRole("heading", { level: 1, name: /help.*support/i })).toBeVisible();
  });

  test("logout button logs user out", async ({ logoutPage }) => {
    await logoutPage.goto("/settings");

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
