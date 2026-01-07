import { expect, test } from "./fixtures";
import {
  cleanupVerifications,
  disconnectDb,
  getOTPForEmail,
} from "./helpers/db";

const TEST_EMAIL = `e2e-otp-${Date.now()}@zoonk.test`;
const REDIRECT_URL = "http://localhost:3000/test";

test.describe("OTP Login Flow", () => {
  test.afterAll(async () => {
    await cleanupVerifications(TEST_EMAIL);
    await disconnectDb();
  });

  test("completes email submission and shows OTP page", async ({ page }) => {
    await page.goto(`/en/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/otp/);

    await expect(
      page.getByRole("heading", { name: /check your email/i }),
    ).toBeVisible();

    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test("validates OTP and redirects with token", async ({ page }) => {
    await page.goto(`/en/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/otp/);

    const otp = await getOTPForEmail(TEST_EMAIL);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    const redirectPromise = page.waitForRequest((request) => {
      const url = request.url();
      return url.startsWith(REDIRECT_URL) && url.includes("token=");
    });

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/i }).click();

    const redirectRequest = await redirectPromise;
    const redirectUrl = new URL(redirectRequest.url());

    expect(redirectUrl.origin + redirectUrl.pathname).toBe(REDIRECT_URL);
    expect(redirectUrl.searchParams.get("token")).toBeTruthy();
  });

  test("shows error for invalid OTP", async ({ page }) => {
    await page.goto(`/en/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/otp/);

    await page.getByRole("textbox").click();
    await page.keyboard.type("000000");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page.getByText(/incorrect/i)).toBeVisible();
  });

  test("allows changing email (back to login)", async ({ page }) => {
    await page.goto(
      `/en/otp?email=${encodeURIComponent(TEST_EMAIL)}&redirectTo=${encodeURIComponent(REDIRECT_URL)}`,
    );
    await page.getByRole("link", { name: /change email/i }).click();
    await page.waitForURL(/\/login/);

    await expect(
      page.getByRole("heading", { name: /sign in or create an account/i }),
    ).toBeVisible();
  });
});
