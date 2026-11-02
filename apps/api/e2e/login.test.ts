import { test } from "@zoonk/e2e/fixtures";
import { cleanupVerifications, getOTPForEmail } from "./helpers/db";

/** The E2E server's `MAIN_APP_URL`. */
const MAIN_APP_URL = "http://localhost:49153";

test.describe("Login Page", () => {
  test("signing in directly on the API ends in the main app", async ({ page }) => {
    const email = `e2e-direct-login-${Date.now()}@zoonk.test`;

    await page.goto("/auth/login");
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp\?email=[^&]+$/u);

    const otp = await getOTPForEmail(email);
    await page.getByRole("textbox", { name: "Code from the email" }).fill(otp ?? "");

    await page.waitForURL(/\/auth\/setup$/u);
    await page.getByRole("textbox", { exact: true, name: "Name" }).fill("Direct Learner");

    const mainLogin = page.waitForRequest((request) => request.url() === `${MAIN_APP_URL}/login`);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await mainLogin;

    const again = page.waitForRequest((request) => request.url() === `${MAIN_APP_URL}/login`);
    await page.goto("/auth/login").catch(() => null);
    await again;

    await cleanupVerifications(email);
  });
});
