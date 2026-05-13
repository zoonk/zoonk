import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Login Page", () => {
  test("displays login form with email input and social buttons", async ({ page }) => {
    await page.goto("/auth/login");

    // Verify heading
    await expect(
      page.getByRole("heading", { name: /sign in or create an account/iu }),
    ).toBeVisible();

    // Verify email form elements
    await expect(page.getByLabel(/email/iu)).toBeVisible();

    await expect(page.getByRole("button", { name: /^continue$/iu })).toBeVisible();

    // Verify social login buttons
    await expect(page.getByRole("button", { name: /continue with google/iu })).toBeVisible();

    await expect(page.getByRole("button", { name: /continue with apple/iu })).toBeVisible();
  });
});
