import { expect, test } from "./fixtures";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";

const TEST_EMAIL = `e2e-otp-${Date.now()}@zoonk.test`;
const REDIRECT_URL = "http://localhost:49152/test";

test.describe("OTP Login Flow", () => {
  test.afterAll(async () => {
    await cleanupVerifications(TEST_EMAIL);
    await disconnectDb();
  });

  test("completes email submission and shows OTP page", async ({ page }) => {
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/auth\/otp/);

    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();

    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test("validates OTP and redirects to setup for new user", async ({ page }) => {
    const email = `e2e-otp-validate-${Date.now()}@zoonk.test`;

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

    // New users without name/username are redirected to setup
    await page.waitForURL(/\/auth\/setup/);
    await expect(page.getByRole("heading", { name: /complete your profile/i })).toBeVisible();

    await cleanupVerifications(email);
  });

  test("shows error for invalid OTP", async ({ page }) => {
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL(/\/auth\/otp/);

    await page.getByRole("textbox").click();
    await page.keyboard.type("000000");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page.getByText(/incorrect/i)).toBeVisible();
  });

  test("allows changing email (back to login)", async ({ page }) => {
    await page.goto(
      `/auth/otp?email=${encodeURIComponent(TEST_EMAIL)}&redirectTo=${encodeURIComponent(REDIRECT_URL)}`,
    );
    await page.getByRole("link", { name: /change email/i }).click();
    await page.waitForURL(/\/auth\/login/);

    await expect(
      page.getByRole("heading", { name: /sign in or create an account/i }),
    ).toBeVisible();
  });

  test("handles redirect URL with trailing slash without double slashes", async ({ page }) => {
    const trailingSlashUrl = "http://localhost:49152/test/";
    const email = `e2e-otp-trailing-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(trailingSlashUrl)}`);
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

    // New user will be redirected to setup first
    await page.waitForURL(/\/auth\/setup/);

    // Complete setup to continue the redirect flow
    await page.getByRole("textbox", { name: /^name$/i }).fill("Trailing Slash User");
    await page.getByRole("textbox", { name: /username/i }).fill(`trailing${Date.now()}`);
    await expect(page.getByText(/is available/i)).toBeVisible();

    // Register listener BEFORE the click that triggers the redirect.
    // waitForRequest only captures requests after registration,
    // so registering after click risks missing fast redirects.
    const redirectPromise = page.waitForRequest((request) => {
      const url = request.url();
      return url.startsWith("http://localhost:49152/test/") && url.length > 28;
    });

    await page.getByRole("button", { name: /^continue$/i }).click();

    const redirectRequest = await redirectPromise;
    const redirectUrl = new URL(redirectRequest.url());

    // Verify no double slashes in the path
    expect(redirectUrl.pathname).not.toContain("//");
    // Verify token is present
    expect(redirectUrl.pathname.split("/").filter(Boolean).length).toBe(2);

    await cleanupVerifications(email);
  });
});
