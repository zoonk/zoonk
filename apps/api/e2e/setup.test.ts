import { expect, test } from "@zoonk/e2e/fixtures";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";

const REDIRECT_URL = "http://localhost:49152/test";

test.describe("Profile Setup Flow", () => {
  test.afterAll(async () => {
    await disconnectDb();
  });

  test("new user is redirected to setup after OTP", async ({ page }) => {
    const email = `e2e-setup-redirect-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const otp = await getOTPForEmail(email);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await page.waitForURL(/\/auth\/setup/u);

    await expect(page.getByRole("heading", { name: /complete your profile/iu })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^name$/iu })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /username/iu })).toBeVisible();

    await cleanupVerifications(email);
  });

  test("completes setup and redirects to callback", async ({ page }) => {
    const email = `e2e-setup-full-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const otp = await getOTPForEmail(email);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await page.waitForURL(/\/auth\/setup/u);

    await page.getByRole("textbox", { name: /^name$/iu }).fill("Test User");
    await page.getByRole("textbox", { name: /username/iu }).fill(`testuser${Date.now()}`);

    // Wait for availability check to complete
    await expect(page.getByText(/is available/iu)).toBeVisible();

    const redirectPromise = page.waitForRequest((req) => {
      const url = req.url();
      return url.startsWith(REDIRECT_URL) && new URL(url).searchParams.has("token");
    });

    await page.getByRole("button", { name: /^continue$/iu }).click();

    const redirectRequest = await redirectPromise;
    const redirectUrl = new URL(redirectRequest.url());

    expect(`${redirectUrl.origin}${redirectUrl.pathname}`).toBe(REDIRECT_URL);
    expect(redirectUrl.searchParams.get("token")).toBeTruthy();

    await cleanupVerifications(email);
  });

  test("shows taken for blocked username", async ({ page }) => {
    const email = `e2e-setup-blocked-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const otp = await getOTPForEmail(email);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await page.waitForURL(/\/auth\/setup/u);

    await page.getByRole("textbox", { name: /username/iu }).fill("admin");

    await expect(page.getByText(/is already taken/iu)).toBeVisible();

    await cleanupVerifications(email);
  });

  test("shows validation for short username", async ({ page }) => {
    const email = `e2e-setup-short-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const otp = await getOTPForEmail(email);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await page.waitForURL(/\/auth\/setup/u);

    await page.getByRole("textbox", { name: /username/iu }).fill("ab");

    await expect(page.getByText(/3-30 characters/iu)).toBeVisible();

    await cleanupVerifications(email);
  });
});
