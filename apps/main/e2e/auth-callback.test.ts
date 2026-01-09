import { expect, test } from "./fixtures";

test.describe("Auth Callback - Invalid Token", () => {
  test("shows error page when verification fails", async ({ page }) => {
    // Mock API to return 401 error (how Better Auth returns errors)
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.includes("one-time-token")) {
        await route.fulfill({
          body: JSON.stringify({
            code: "INVALID_TOKEN",
            message: "Invalid or expired one-time token",
          }),
          contentType: "application/json",
          status: 401,
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/en/auth/callback/invalid-token");

    await expect(page.getByText(/authentication error/i)).toBeVisible();
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
    await expect(page.getByText(/hello@zoonk\.com/i)).toBeVisible();
  });

  test("shows Portuguese error page on invalid token", async ({ page }) => {
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.includes("one-time-token")) {
        await route.fulfill({
          body: JSON.stringify({
            code: "INVALID_TOKEN",
            message: "Invalid or expired one-time token",
          }),
          contentType: "application/json",
          status: 401,
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/pt/auth/callback/invalid-token");

    // Check for link to Portuguese login page
    await expect(page.locator('a[href="/pt/login"]')).toBeVisible();
  });
});

test.describe("Auth Callback - Valid Token", () => {
  test("redirects to home on successful verification", async ({ page }) => {
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.includes("one-time-token")) {
        await route.fulfill({
          body: JSON.stringify({ session: { id: "test", userId: "test" } }),
          contentType: "application/json",
          status: 200,
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/en/auth/callback/valid-token");
    await page.waitForURL(/^(?!.*\/auth\/callback)/);
  });
});
