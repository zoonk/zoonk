import { test } from "@zoonk/e2e/fixtures";
import { cleanupVerifications, getOTPForEmail } from "./helpers/db";
import { E2E_MAIN_APP_URL } from "./main-app-url";

test.describe("Login Page", () => {
  test("signing in directly on the API ends in the main app", async ({ page }) => {
    const email = `e2e-direct-login-${Date.now()}@zoonk.test`;

    await page.goto("/auth/login");
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/en\/otp\?email=[^&]+$/u);

    const otp = await getOTPForEmail(email);
    await page.getByRole("textbox", { name: "Code from the email" }).fill(otp ?? "");

    await page.waitForURL(/\/auth\/en\/setup$/u);
    await page.getByRole("textbox", { exact: true, name: "Name" }).fill("Direct Learner");

    const mainLogin = page.waitForRequest(
      (request) => request.url() === `${E2E_MAIN_APP_URL}/login`,
    );

    await page.getByRole("button", { name: /^continue$/iu }).click();
    await mainLogin;

    const again = page.waitForRequest((request) => request.url() === `${E2E_MAIN_APP_URL}/login`);
    await page.goto("/auth/login").catch(() => null);
    await again;

    await cleanupVerifications(email);
  });
});
