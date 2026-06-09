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

  test("shows a validation error when Better Auth rejects the email", async ({ page }) => {
    await page.goto("/auth/login");

    const emailInput = page.getByLabel(/email/iu);

    await emailInput.fill("not-an-email");
    await emailInput.evaluate((input) => input.closest("form")?.setAttribute("novalidate", ""));
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await expect(page).toHaveURL(/\/auth\/login/u);
    await expect(page.getByText(/enter a valid email address/iu)).toBeVisible();
  });
});
