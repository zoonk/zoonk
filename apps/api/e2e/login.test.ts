import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Login Page", () => {
  test("displays login form with email input and social buttons", async ({ page }) => {
    await page.goto("/auth/login");

    // Verify heading
    await expect(
      page.getByRole("heading", { name: /sign in or create an account/i }),
    ).toBeVisible();

    // Verify email form elements
    await expect(page.getByLabel(/email/i)).toBeVisible();

    await expect(page.getByRole("button", { name: /^continue$/i })).toBeVisible();

    // Verify social login buttons
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();

    await expect(page.getByRole("button", { name: /continue with apple/i })).toBeVisible();
  });
});
