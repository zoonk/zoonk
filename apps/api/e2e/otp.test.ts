import { type Page, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";

const REDIRECT_URL = "http://localhost:49152/test";

async function holdRequests(page: Page, url: string) {
  const held: Route[] = [];

  await page.route(url, (route) => {
    held.push(route);
  });

  return held;
}

test.describe("OTP Login Flow", () => {
  test.afterAll(async () => {
    await disconnectDb();
  });

  test("asks for the emailed code, which pasted signs a new account in to its setup", async ({
    page,
  }) => {
    const email = `e2e-otp-validate-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const input = page.getByRole("textbox", { name: "Code from the email" });

    const otp = await getOTPForEmail(email);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.evaluate(
      (code) => navigator.clipboard.writeText(code),
      `${otp.slice(0, 3)} ${otp.slice(3)}`,
    );

    await input.focus();
    await page.keyboard.press("ControlOrMeta+V");

    await expect(input).toHaveValue(otp);

    await page.waitForURL(/\/auth\/setup/u);
    await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();

    await cleanupVerifications(email);
  });

  test("says a code is wrong, retries it after a dropped connection, and after too many wrong tries asks for a new code that signs in", async ({
    page,
  }) => {
    const email = `e2e-otp-attempts-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const code = await getOTPForEmail(email);
    const wrongCode = code === "000000" ? "111111" : "000000";
    const input = page.getByRole("textbox", { name: "Code from the email" });
    const continueButton = page.getByRole("button", { name: /^continue$/iu });
    const wrong = page.getByText("That code isn't right. Check the email and try again.");
    const tooMany = page.getByText("Too many wrong tries with this code. Get a new one.");

    async function tryCode(attempt: string) {
      await expect(continueButton).toBeEnabled();

      const checked = page.waitForResponse((response) =>
        response.url().includes("/sign-in/email-otp"),
      );

      await input.fill("");
      await input.fill(attempt);
      await checked;
    }

    await tryCode(wrongCode);
    await expect(wrong).toBeVisible();

    await expect(continueButton).toBeEnabled();
    await page.route("**/sign-in/email-otp", (route) => route.abort("internetdisconnected"));
    await page.keyboard.press("Enter");

    await expect(page.getByText("Something went wrong. Try again in a moment.")).toBeVisible();

    await page.unroute("**/sign-in/email-otp");
    await page.keyboard.press("Enter");
    await expect(wrong).toBeVisible();

    await tryCode(wrongCode);

    await tryCode(code ?? "");
    await expect(tooMany).toBeVisible();

    await expect(continueButton).toHaveCount(0);
    await expect(input).toBeDisabled();

    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByText(`We sent a new code to ${email}.`)).toBeVisible();

    const newCode = await getOTPForEmail(email);
    await input.fill(newCode ?? "");

    await page.waitForURL(/\/auth\/setup/u);

    await cleanupVerifications(email);
  });

  test("a code typed while the last one is checked is checked next, and only once", async ({
    page,
  }) => {
    const email = `e2e-otp-in-flight-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const code = (await getOTPForEmail(email)) ?? "";
    const wrongCode = code === "000000" ? "111111" : "000000";
    const input = page.getByRole("textbox", { name: "Code from the email" });
    const checks = await holdRequests(page, "**/sign-in/email-otp");
    const checkedCodes = () => checks.map((check) => String(check.request().postDataJSON().otp));

    await input.fill(wrongCode);
    await expect.poll(checkedCodes).toEqual([wrongCode]);
    await input.fill("");
    await input.fill(wrongCode);
    await checks[0]?.continue();

    await expect(
      page.getByText("That code isn't right. Check the email and try again."),
    ).toBeVisible();

    expect(checkedCodes()).toEqual([wrongCode]);

    await input.fill("");
    await input.fill(wrongCode);
    await expect.poll(checkedCodes).toEqual([wrongCode, wrongCode]);
    await expect(page.getByRole("button", { name: "Send again" })).toBeDisabled();
    await input.fill("");
    await input.fill(code);
    await checks[1]?.continue();

    await expect.poll(checkedCodes).toEqual([wrongCode, wrongCode, code]);
    await checks[2]?.continue();

    await page.waitForURL(/\/auth\/setup/u);

    await cleanupVerifications(email);
  });

  test("an expired code asks for a new one", async ({ page }) => {
    const email = `e2e-otp-expired-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const code = await getOTPForEmail(email);

    await prisma.verification.updateMany({
      data: { expiresAt: new Date(Date.now() - 60_000) },
      where: { identifier: `sign-in-otp-${email}` },
    });

    await page.getByRole("textbox", { name: "Code from the email" }).fill(code ?? "");

    await expect(page.getByText("This code expired. Get a new one.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a new code" })).toBeVisible();

    await cleanupVerifications(email);
  });

  test("sends a new code on request, and only the new one works", async ({ page }) => {
    const email = `e2e-otp-resend-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const firstCode = (await getOTPForEmail(email)) ?? "";
    const wrongCode = firstCode === "000000" ? "111111" : "000000";
    const input = page.getByRole("textbox", { name: "Code from the email" });
    const sendAgain = page.getByRole("button", { name: "Send again" });
    const newCodeUrl = "**/email-otp/send-verification-otp";
    const checkedCodes: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/sign-in/email-otp")) {
        checkedCodes.push(request.postDataJSON().otp);
      }
    });

    await page.route(newCodeUrl, (route) => route.abort("internetdisconnected"));
    await sendAgain.click();

    await expect(page.getByText("We couldn't send a new code. Try again.")).toBeVisible();

    await page.unroute(newCodeUrl);
    await input.fill(wrongCode);

    await expect(
      page.getByText("That code isn't right. Check the email and try again."),
    ).toBeVisible();

    const newCodeRequests = await holdRequests(page, newCodeUrl);
    await sendAgain.click();
    await expect.poll(() => newCodeRequests).toHaveLength(1);

    await input.fill("");
    await input.fill(firstCode);
    await newCodeRequests[0]?.continue();

    await expect(page.getByText(`We sent a new code to ${email}.`)).toBeVisible();
    await expect(input).toHaveValue("");
    expect(checkedCodes).toEqual([wrongCode]);

    await expect.poll(() => getOTPForEmail(email)).not.toBe(firstCode);
    const newCode = await getOTPForEmail(email);

    await input.fill(newCode ?? "");

    await page.waitForURL(/\/auth\/setup/u);

    await cleanupVerifications(email);
  });
});
