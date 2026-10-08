import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
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
    await page.getByLabel(/email/iu).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    await expect(page.getByRole("heading", { name: /check your email/iu })).toBeVisible();

    await expect(page.getByText(TEST_EMAIL)).toBeVisible();

    // Ready for the code at once: focused, with the phone's number pad and its code suggestion.
    const code = page.getByRole("textbox", { name: "Code from the email" });

    await expect(code).toBeFocused();
    await expect(code).toHaveAttribute("inputmode", "numeric");
    await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  });

  test("validates OTP and redirects to setup for new user", async ({ page }) => {
    const email = `e2e-otp-validate-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const otp = await getOTPForEmail(email);

    if (!otp) {
      throw new Error("OTP not found in database");
    }

    // Pasted straight into the focused input, even copied with a space in the middle. The paste
    // waits for the input to take focus, as a learner's does: the form arrives after the URL does.
    const input = page.getByRole("textbox", { name: "Code from the email" });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.evaluate(
      (code) => navigator.clipboard.writeText(code),
      `${otp.slice(0, 3)} ${otp.slice(3)}`,
    );

    await expect(input).toBeFocused();
    await page.keyboard.press("ControlOrMeta+V");

    await expect(input).toHaveValue(otp);
    await page.getByRole("button", { name: /^continue$/iu }).click();

    // New users are asked for a name and a username
    await page.waitForURL(/\/auth\/setup/u);
    await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();

    await cleanupVerifications(email);
  });

  test("shows error for invalid OTP", async ({ page }) => {
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(TEST_EMAIL);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    await page.getByRole("textbox").click();
    await page.keyboard.type("000000");
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await expect(
      page.getByText("That code isn't right. Check the email and try again."),
    ).toBeVisible();
  });

  test("after too many wrong tries, asks for a new code, and the new code signs in", async ({
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
    const tooMany = page.getByText("Too many wrong tries with this code. Get a new one.");

    /** One try. The button stays disabled while a try is checked, so the next one waits for it. */
    async function tryCode(attempt: string) {
      await input.fill(attempt);
      await page.getByRole("button", { name: /^continue$/iu }).click();
    }

    await tryCode(wrongCode);

    await expect(
      page.getByText("That code isn't right. Check the email and try again."),
    ).toBeVisible();

    await tryCode(wrongCode);
    await tryCode(wrongCode);

    // Auth allows three tries per code: the fourth, even the right code, says the code is gone.
    await tryCode(code ?? "");
    await expect(tooMany).toBeVisible();

    await expect(page.getByRole("button", { name: /^continue$/iu })).toHaveCount(0);
    await expect(input).toBeDisabled();

    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByText(`We sent a new code to ${email}.`)).toBeVisible();

    const newCode = await getOTPForEmail(email);
    await input.fill(newCode ?? "");
    await page.getByRole("button", { name: /^continue$/iu }).click();

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
    await page.getByRole("button", { name: /^continue$/iu }).click();

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

    const firstCode = await getOTPForEmail(email);

    await page.getByRole("button", { name: "Didn't get it? Send a new code" }).click();
    await expect(page.getByText(`We sent a new code to ${email}.`)).toBeVisible();

    await expect.poll(() => getOTPForEmail(email)).not.toBe(firstCode);
    const newCode = await getOTPForEmail(email);

    await page.getByRole("textbox", { name: "Code from the email" }).fill(newCode ?? "");
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await page.waitForURL(/\/auth\/setup/u);

    await cleanupVerifications(email);
  });

  test("allows changing email (back to login)", async ({ page }) => {
    await page.goto(
      `/auth/otp?email=${encodeURIComponent(TEST_EMAIL)}&redirectTo=${encodeURIComponent(REDIRECT_URL)}`,
    );

    const continueButton = page.getByRole("button", { name: /^continue$/iu });
    const changeEmailLink = page.getByRole("link", { name: /change email/iu });

    await expect(continueButton).toHaveAttribute("aria-keyshortcuts", "Enter");
    await expect(continueButton.getByText("Enter")).toBeVisible();
    await expect(changeEmailLink).toHaveAttribute("aria-keyshortcuts", "Escape");
    await expect(changeEmailLink.getByText("Esc")).toBeVisible();

    await page.getByRole("textbox").click();
    await page.keyboard.press("Escape");
    await page.waitForURL(/\/auth\/login/u);

    await expect(
      page.getByRole("heading", { name: /sign in or create an account/iu }),
    ).toBeVisible();
  });

  test("handles redirect URL with trailing slash without double slashes", async ({ page }) => {
    const trailingSlashUrl = "http://localhost:49152/test/";
    const email = `e2e-otp-trailing-${Date.now()}@zoonk.test`;

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(trailingSlashUrl)}`);
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

    // New user will be redirected to setup first
    await page.waitForURL(/\/auth\/setup/u);

    // Complete setup to continue the redirect flow
    await page.getByRole("textbox", { name: /^name$/iu }).fill("Trailing Slash User");

    // Register listener BEFORE the click that triggers the redirect.
    // waitForRequest only captures requests after registration,
    // so registering after click risks missing fast redirects.
    const redirectPromise = page.waitForRequest((req) => {
      const url = req.url();
      return url.startsWith("http://localhost:49152/test/") && url.length > 28;
    });

    await page.getByRole("button", { name: /^continue$/iu }).click();

    const redirectRequest = await redirectPromise;
    const redirectUrl = new URL(redirectRequest.url());

    // Verify no double slashes in the path
    expect(redirectUrl.pathname).not.toContain("//");
    // Verify token is present
    expect(redirectUrl.searchParams.get("token")).toBeTruthy();

    await cleanupVerifications(email);
  });
});
