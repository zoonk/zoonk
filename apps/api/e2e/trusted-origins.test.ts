import { expect, test } from "@zoonk/e2e/fixtures";
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

    await page.getByLabel(/email/iu).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const otp = await getOTPForEmail(TEST_EMAIL);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.getByRole("textbox").click();
    await page.keyboard.type(otp);
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await page.waitForURL(/\/auth\/untrusted-origin/u);

    await expect(page.getByRole("heading", { name: /unable to redirect/iu })).toBeVisible();

    await expect(page.getByRole("link", { name: /continue to zoonk/iu })).toBeVisible();

    const link = page.getByRole("link", { name: /continue to zoonk/iu });
    await expect(link).toHaveAttribute("href", "https://www.zoonk.com");
  });
});
