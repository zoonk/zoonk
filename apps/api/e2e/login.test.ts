import { randomUUID } from "node:crypto";
import { expect, test } from "@zoonk/e2e/fixtures";
import { holdScripts } from "@zoonk/e2e/hydration";
import { cleanupVerifications, getOTPForEmail } from "./helpers/db";
import { clickWithConnectionDown } from "./helpers/server-actions";
import { E2E_MAIN_APP_URL } from "./main-app-url";

test.describe("Login Page", () => {
  test("signing in directly on the API ends in the main app, after a mistyped email sent before the page loaded and a dropped connection", async ({
    page,
  }) => {
    const email = `e2e-direct-login-${randomUUID()}@zoonk.test`;
    const emailField = page.getByLabel(/email/iu);
    const sendCode = page.getByRole("button", { name: /^continue$/iu });

    const loadScripts = await holdScripts(page);
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await emailField.fill("a@b");
    await sendCode.click();
    await loadScripts();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(emailField).toHaveValue("a@b");

    await emailField.fill(email);
    await clickWithConnectionDown(sendCode);

    await expect(page.getByText(/There was an error signing you in/u)).toBeVisible();
    await expect(emailField).toHaveValue(email);

    await sendCode.click();
    await page.waitForURL(/\/auth\/en\/otp\?email=[^&]+$/u);

    const otp = await getOTPForEmail(email);
    await page.getByRole("textbox", { name: "Code from the email" }).fill(otp ?? "");

    await page.waitForURL(/\/auth\/en\/setup$/u);
    await page.getByRole("textbox", { exact: true, name: "Name" }).fill("Direct Learner");

    const mainLogin = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/auth/callback" &&
        response.headers().location === `${E2E_MAIN_APP_URL}/login`,
    );

    await page.getByRole("button", { name: /^continue$/iu }).click();
    const redirect = await mainLogin;
    expect(redirect.status()).toBe(307);

    const signedIn = await page.request.get("/auth/login", { maxRedirects: 0 });
    expect(signedIn.status()).toBe(307);
    expect(signedIn.headers().location).toBe("/auth/callback");

    const again = await page.request.get("/auth/callback", { maxRedirects: 0 });
    expect(again.status()).toBe(307);
    expect(again.headers().location).toBe(`${E2E_MAIN_APP_URL}/login`);

    await cleanupVerifications(email);
  });
});
