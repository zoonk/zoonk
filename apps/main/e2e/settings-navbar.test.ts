import { expect, test } from "./fixtures";

test.describe("Settings Navbar", () => {
  test("home link navigates to home page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("link", { name: /home page/iu }).click();

    await expect(page.getByRole("heading", { name: /learn anything with ai/iu })).toBeVisible();
  });

  test("displays all settings navigation pills", async ({ page }) => {
    await page.goto("/subscription");

    await expect(page.getByRole("link", { name: /subscription/iu })).toBeVisible();
    await expect(page.getByRole("link", { name: /language/iu })).toBeVisible();
    await expect(page.getByRole("link", { name: /profile/iu })).toBeVisible();
    await expect(page.getByRole("link", { name: /support/iu })).toBeVisible();
  });

  test("Subscription pill navigates to subscription page", async ({ page }) => {
    await page.goto("/language");
    await page.getByRole("link", { name: /subscription/iu }).click();

    await expect(page.getByRole("heading", { level: 1, name: /subscription/iu })).toBeVisible();
  });

  test("Language pill navigates to language page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("link", { name: /language/iu }).click();

    await expect(page.getByRole("heading", { level: 1, name: /language/iu })).toBeVisible();
  });

  test("Profile pill navigates to profile page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("link", { name: /profile/iu }).click();

    await expect(page.getByRole("heading", { level: 1, name: /profile/iu })).toBeVisible();
  });

  test("Support pill navigates to support page", async ({ page }) => {
    await page.goto("/subscription");
    await page.getByRole("link", { name: /support/iu }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /feedback & support/iu }),
    ).toBeVisible();
  });

  test("logout button logs user out", async ({ logoutPage }) => {
    await logoutPage.goto("/subscription");

    await expect(logoutPage.getByRole("button", { name: /logout/iu })).toBeVisible();

    await logoutPage.getByRole("button", { name: /logout/iu }).click();
    await logoutPage.waitForURL(/^[^?]*\/$/u);
    await logoutPage.waitForLoadState("networkidle");

    // Scope to navigation to avoid strict mode violation
    await logoutPage
      .getByRole("navigation")
      .getByRole("button", { name: /search/iu })
      .click();

    await expect(logoutPage.getByRole("dialog").getByText(/^login$/iu)).toBeVisible();
  });
});
