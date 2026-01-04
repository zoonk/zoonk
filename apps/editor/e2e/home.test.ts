import { expect, test } from "./fixtures";

test.describe("Home Page - Unauthenticated", () => {
  test("shows unauthorized page with login link", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /401 - unauthorized/i }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  });
});

test.describe("Home Page - Authenticated without org", () => {
  test("shows unauthorized page with logout link", async ({
    userWithoutOrg,
  }) => {
    await userWithoutOrg.goto("/");

    await expect(
      userWithoutOrg.getByRole("heading", { name: /401 - unauthorized/i }),
    ).toBeVisible();

    await expect(
      userWithoutOrg.getByRole("link", { name: /logout/i }),
    ).toBeVisible();
  });
});

test.describe("Home Page - Authenticated with org", () => {
  test("redirects to active organization page", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await authenticatedPage.waitForURL(/\/ai/);

    await expect(authenticatedPage).toHaveURL(/\/ai/);
  });
});
