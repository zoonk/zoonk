import { expect, test } from "./fixtures";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";

const TEST_EMAIL = `e2e-setup-${Date.now()}@zoonk.test`;
const REDIRECT_URL = "http://localhost:49152/test";

test.describe("Profile Setup Flow", () => {
  test.afterAll(async () => {
    await cleanupVerifications(TEST_EMAIL);
    await disconnectDb();
  });

  test("new user is redirected to setup after OTP", async ({ page }) => {
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/auth\/otp/);

    const otp = await getOTPForEmail(TEST_EMAIL);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.waitForURL(/\/auth\/setup/);

    await expect(page.getByRole("heading", { name: /complete your profile/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^name$/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /username/i })).toBeVisible();
  });

  test("completes setup and redirects to callback", async ({ page }) => {
    const email = `e2e-setup-full-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/auth\/otp/);

    const otp = await getOTPForEmail(email);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.waitForURL(/\/auth\/setup/);

    await page.getByRole("textbox", { name: /^name$/i }).fill("Test User");
    await page.getByRole("textbox", { name: /username/i }).fill(`testuser${Date.now()}`);

    // Wait for availability check to complete
    await expect(page.getByText(/is available/i)).toBeVisible();

    const redirectPromise = page.waitForRequest((request) => {
      const url = request.url();
      return url.startsWith(REDIRECT_URL) && url.split("/").length > 4;
    });

    await page.getByRole("button", { name: /^continue$/i }).click();

    const redirectRequest = await redirectPromise;
    const redirectUrl = new URL(redirectRequest.url());
    const pathSegments = redirectUrl.pathname.split("/").filter(Boolean);

    expect(`${redirectUrl.origin}/${pathSegments[0]}`).toBe(REDIRECT_URL);
    expect(pathSegments[1]).toBeTruthy();

    await cleanupVerifications(email);
  });

  test("shows validation for short username", async ({ page }) => {
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/auth\/otp/);

    const otp = await getOTPForEmail(TEST_EMAIL);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.waitForURL(/\/auth\/setup/);

    await page.getByRole("textbox", { name: /username/i }).fill("ab");

    await expect(page.getByText(/3-30 characters/i)).toBeVisible();
  });
});
