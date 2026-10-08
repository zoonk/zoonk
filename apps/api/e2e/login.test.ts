import { expect, test } from "@zoonk/e2e/fixtures";
import { cleanupVerifications, getOTPForEmail } from "./helpers/db";

/** Where a sign-in that started on the API ends (the E2E server's `MAIN_APP_URL`). */
const MAIN_APP_URL = "http://localhost:49153";

test.describe("Login Page", () => {
  test("uses the locale passed by the originating app throughout auth", async ({ page }) => {
    await page.goto("/auth/login?locale=pt");

    await expect(page.getByRole("heading", { name: "Entre ou crie uma conta" })).toBeVisible();

    await page.goto("/auth/otp?email=learner@zoonk.test");

    await expect(page.getByRole("heading", { name: "Confira seu email" })).toBeVisible();
  });

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

  test("the brain goes back to the main app", async ({ page }) => {
    const appCallback = "http://localhost:49152/auth/callback?state=abc";

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(appCallback)}`);

    await expect(page.getByRole("link", { name: "Back to Zoonk" })).toHaveAttribute(
      "href",
      MAIN_APP_URL,
    );
  });

  test("the code page without an email starts over, still going back to the same app", async ({
    page,
  }) => {
    const appCallback = "http://localhost:49152/auth/callback?state=abc";

    await page.goto(`/auth/otp?redirectTo=${encodeURIComponent(appCallback)}`);

    await expect(page).toHaveURL(/\/auth\/login\?/u);
    expect(new URL(page.url()).searchParams.get("redirectTo")).toBe(appCallback);
    await expect(page.getByText(/undefined/u)).toHaveCount(0);
  });

  test("signing in directly on the API ends in the main app", async ({ page }) => {
    const email = `e2e-direct-login-${Date.now()}@zoonk.test`;

    await page.goto("/auth/login");
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp\?email=[^&]+$/u);

    const otp = await getOTPForEmail(email);
    await page.getByRole("textbox", { name: "Code from the email" }).fill(otp ?? "");
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await page.waitForURL(/\/auth\/setup$/u);
    await page.getByRole("textbox", { exact: true, name: "Name" }).fill("Direct Learner");

    // The main app's login hands the session over; nothing listens there in this test.
    const mainLogin = page.waitForRequest((request) => request.url() === `${MAIN_APP_URL}/login`);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await mainLogin;

    // Back on sign-in later, the session goes straight to the main app too.
    const again = page.waitForRequest((request) => request.url() === `${MAIN_APP_URL}/login`);
    await page.goto("/auth/login").catch(() => null);
    await again;

    await cleanupVerifications(email);
  });
});
