import { expect, test } from "./fixtures";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";

const TEST_EMAIL = `e2e-trusted-${Date.now()}@zoonk.test`;
const UNTRUSTED_URL = "https://evil-site.com/steal";

test.describe("Trusted Origin Validation", () => {
  test.afterAll(async () => {
    await cleanupVerifications(TEST_EMAIL);
    await disconnectDb();
  });

  test("shows error page for untrusted external URL", async ({ page }) => {
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(UNTRUSTED_URL)}`);

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

    await page.waitForURL(/\/auth\/untrusted-origin/);

    await expect(page.getByRole("heading", { name: /unable to redirect/i })).toBeVisible();

    await expect(page.getByRole("link", { name: /continue to zoonk/i })).toBeVisible();

    const link = page.getByRole("link", { name: /continue to zoonk/i });
    await expect(link).toHaveAttribute("href", "https://www.zoonk.com");
  });
});
