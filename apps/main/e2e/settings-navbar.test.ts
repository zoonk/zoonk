import { expect, test } from "./fixtures";

test.describe("Settings Navbar", () => {
  test("home link navigates to home page", async ({ page }) => {
    await page.goto("/en/settings");
    await page.getByRole("link", { name: /home page/i }).click();

    await expect(
      page.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();
  });

  test("dropdown Settings item navigates to settings page", async ({
    page,
  }) => {
    await page.goto("/en/subscription");
    await page.getByRole("button", { name: /subscription/i }).click();
    await page.getByRole("menuitem", { name: /^settings$/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();
  });

  test("dropdown Subscription item navigates to subscription page", async ({
    page,
  }) => {
    await page.goto("/en/settings");
    await page.getByRole("button", { name: /settings/i }).click();
    await page.getByRole("menuitem", { name: /subscription/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /subscription/i }),
    ).toBeVisible();
  });

  test("dropdown Language item navigates to language page", async ({
    page,
  }) => {
    await page.goto("/en/settings");
    await page.getByRole("button", { name: /settings/i }).click();
    await page.getByRole("menuitem", { name: /language/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /language/i }),
    ).toBeVisible();
  });

  test("dropdown Display name item navigates to name page", async ({
    page,
  }) => {
    await page.goto("/en/settings");
    await page.getByRole("button", { name: /settings/i }).click();
    await page.getByRole("menuitem", { name: /display name/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /display name/i }),
    ).toBeVisible();
  });

  test("dropdown Support item navigates to support page", async ({ page }) => {
    await page.goto("/en/settings");
    await page.getByRole("button", { name: /settings/i }).click();
    await page.getByRole("menuitem", { name: /support/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /help.*support/i }),
    ).toBeVisible();
  });

  test("logout button logs user out", async ({ logoutPage }) => {
    await logoutPage.goto("/en/settings");

    await expect(
      logoutPage.getByRole("link", { name: /logout/i }),
    ).toBeVisible();

    // Click logout - this triggers a hard navigation via window.location.href
    await logoutPage.getByRole("link", { name: /logout/i }).click();

    // Wait for navigation to complete (home page with locale)
    await logoutPage.waitForURL(/\/(en|pt)\/?$/);

    await logoutPage.getByRole("button", { name: /search/i }).click();

    await expect(
      logoutPage.getByRole("dialog").getByText(/^login$/i),
    ).toBeVisible();
  });
});
