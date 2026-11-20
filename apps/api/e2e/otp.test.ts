import { type Page, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";
import { E2E_MAIN_APP_URL } from "./main-app-url";

const REDIRECT_URL = `${E2E_MAIN_APP_URL}/test`;

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
    await page.waitForURL(/\/auth\/en\/otp/u);

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

    await page.waitForURL(/\/auth\/en\/setup/u);
    await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();

    await cleanupVerifications(email);
  });

  test("says a code is wrong and doesn't check it again, retries a dropped check, and after too many wrong tries asks for a new code that signs in", async ({
    page,
  }) => {
    const email = `e2e-otp-attempts-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/en\/otp/u);

    const code = (await getOTPForEmail(email)) ?? "";

    const [wrongCode = "", secondWrongCode = "", thirdWrongCode = ""] = [
      "000000",
      "111111",
      "222222",
      "333333",
    ].filter((candidate) => candidate !== code);

    const input = page.getByRole("textbox", { name: "Code from the email" });
    const continueButton = page.getByRole("button", { name: /^continue$/iu });
    const wrong = page.getByText("That code isn't right. Try again.");
    const tooMany = page.getByText("Too many wrong tries. Get a new code.");
    const checkedCodes: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/sign-in/email-otp")) {
        checkedCodes.push(request.postDataJSON().otp);
      }
    });

    async function tryCode(attempt: string) {
      await expect(input).toBeEnabled();
      await expect(continueButton).not.toHaveAttribute("aria-busy", "true");

      const checked = page.waitForResponse((response) =>
        response.url().includes("/sign-in/email-otp"),
      );

      await input.fill("");
      await input.fill(attempt);
      await checked;
    }

    await page.route("**/sign-in/email-otp", (route) => route.abort("internetdisconnected"));
    await input.fill(wrongCode);

    await expect(page.getByText("Something went wrong. Try again in a moment.")).toBeVisible();

    await page.unroute("**/sign-in/email-otp");
    await expect(continueButton).toBeEnabled();
    await page.keyboard.press("Enter");
    await expect(wrong).toBeVisible();

    await expect(continueButton).toBeDisabled();
    await page.keyboard.press("Enter");
    await input.fill("");
    await input.fill(wrongCode);
    await expect(continueButton).toBeDisabled();

    await tryCode(secondWrongCode);
    expect(checkedCodes).toEqual([wrongCode, wrongCode, secondWrongCode]);

    await tryCode(thirdWrongCode);
    await tryCode(code);
    await expect(tooMany).toBeVisible();

    await expect(continueButton).toHaveCount(0);
    await expect(input).toBeDisabled();

    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByText("We emailed you again.")).toBeVisible();

    await expect.poll(() => getOTPForEmail(email)).not.toBe(code);
    const newCode = await getOTPForEmail(email);
    await input.fill(newCode ?? "");

    await page.waitForURL(/\/auth\/en\/setup/u);

    await cleanupVerifications(email);
  });

  test("a code typed while the last one is checked is checked next, and a rejected one never again", async ({
    page,
  }) => {
    const email = `e2e-otp-in-flight-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/en\/otp/u);

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

    await expect(page.getByText("That code isn't right. Try again.")).toBeVisible();

    expect(checkedCodes()).toEqual([wrongCode]);

    await input.fill("");
    await input.fill(wrongCode);
    await expect(page.getByRole("button", { name: /^continue$/iu })).toBeDisabled();
    await input.fill("");
    await input.fill(code);

    await expect.poll(checkedCodes).toEqual([wrongCode, code]);
    await expect(page.getByRole("button", { name: "Send again" })).toBeDisabled();
    await checks[1]?.continue();

    await page.waitForURL(/\/auth\/en\/setup/u);

    await cleanupVerifications(email);
  });

  test("an expired code asks for a new one", async ({ page }) => {
    const email = `e2e-otp-expired-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/en\/otp/u);

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

  test("emails the same code again on request, so the first email still signs in", async ({
    page,
  }) => {
    const email = `e2e-otp-resend-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/en\/otp/u);

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

    await expect(page.getByText("That code isn't right. Try again.")).toBeVisible();

    const newCodeRequests = await holdRequests(page, newCodeUrl);
    await sendAgain.click();
    await expect.poll(() => newCodeRequests).toHaveLength(1);

    await input.fill("");
    await input.fill(firstCode);
    await newCodeRequests[0]?.continue();

    await expect(page.getByText("We emailed you again.")).toBeVisible();
    await expect(input).toHaveValue("");
    expect(checkedCodes).toEqual([wrongCode]);

    await expect(getOTPForEmail(email)).resolves.toBe(firstCode);
    await input.fill(firstCode);

    await page.waitForURL(/\/auth\/en\/setup/u);

    await cleanupVerifications(email);
  });
});

test("requires the email code before continuing", async ({ page }) => {
  await page.goto("/auth/en/otp?email=learner%40example.test");

  const code = page.getByRole("textbox", { name: "Code from the email" });
  const next = page.getByRole("button", { exact: true, name: "Continue" });
  await expectHydrated(code);

  await expect(next).toBeDisabled();
  await code.fill("123");
  await expect(next).toBeDisabled();
});
