import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";

const REDIRECT_URL = "http://localhost:49152/test";

/** Signs a new email in through the code and lands on the profile setup. */
async function signUpToSetup(page: Page, email: string) {
  await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
  await page.getByLabel(/email/iu).fill(email);
  await page.getByRole("button", { name: /^continue$/iu }).click();
  await page.waitForURL(/\/auth\/otp/u);

  const otp = await getOTPForEmail(email);

  if (!otp) {
    throw new Error("OTP not found in database");
  }

  // The sixth digit sends the code.
  await page.getByRole("textbox").click();
  await page.keyboard.type(otp);

  await page.waitForURL(/\/auth\/setup/u);
}

test.describe("Profile Setup Flow", () => {
  test.afterAll(async () => {
    await disconnectDb();
  });

  test("a new account gives its name; the username starts from the email and can change", async ({
    page,
  }) => {
    const prefix = `e2esetup${Date.now()}`;
    const email = `${prefix}@zoonk.test`;
    const chosen = `${prefix}_x`;

    await signUpToSetup(page, email);

    await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
    await expect(page.getByRole("textbox", { exact: true, name: "Name" })).toBeFocused();

    // The username is already picked, as a line under the name, until the learner changes it.
    await expect(page.getByText(`Your username: @${prefix}`)).toBeVisible();
    await page.getByRole("button", { name: "Change username" }).click();

    const username = page.getByRole("textbox", { exact: true, name: "Username" });
    await expect(username).toHaveValue(prefix);
    await expect(username).toBeFocused();

    await page.getByRole("textbox", { exact: true, name: "Name" }).fill("Test User");
    await username.fill(chosen);
    await expect(page.getByText(`${chosen} is available`)).toBeVisible();

    const redirectPromise = page.waitForRequest((req) => {
      const url = req.url();
      return url.startsWith(REDIRECT_URL) && new URL(url).searchParams.has("token");
    });

    await page.getByRole("button", { name: /^continue$/iu }).click();

    const redirectRequest = await redirectPromise;
    const redirectUrl = new URL(redirectRequest.url());

    expect(`${redirectUrl.origin}${redirectUrl.pathname}`).toBe(REDIRECT_URL);
    expect(redirectUrl.searchParams.get("token")).toBeTruthy();

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject({
      name: "Test User",
      username: chosen,
    });

    await cleanupVerifications(email);
  });

  test("an account that already has a name skips the setup, with a username from its email", async ({
    page,
  }) => {
    const prefix = `e2enamed${Date.now()}`;
    const email = `${prefix}@zoonk.test`;

    // As Google or Apple leave a new account: named, without a username.
    await prisma.user.create({ data: { email, emailVerified: true, name: "Named Learner" } });

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(REDIRECT_URL)}`);
    await page.getByLabel(/email/iu).fill(email);
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await page.waitForURL(/\/auth\/otp/u);

    const otp = await getOTPForEmail(email);

    const redirectPromise = page.waitForRequest((req) => {
      const url = req.url();
      return url.startsWith(REDIRECT_URL) && new URL(url).searchParams.has("token");
    });

    await page.getByRole("textbox", { name: "Code from the email" }).fill(otp ?? "");
    await redirectPromise;

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject({
      name: "Named Learner",
      username: prefix,
    });

    await cleanupVerifications(email);
  });

  test("says when a username is taken or doesn't follow the rule, and waits for a good one", async ({
    page,
  }) => {
    const email = `e2e-setup-taken-${Date.now()}@zoonk.test`;

    await signUpToSetup(page, email);
    await page.getByRole("button", { name: "Change username" }).click();

    const username = page.getByRole("textbox", { exact: true, name: "Username" });
    const submit = page.getByRole("button", { name: /^continue$/iu });

    await username.fill("admin");
    await expect(page.getByText("admin is already taken")).toBeVisible();
    await expect(submit).toBeDisabled();

    await username.fill("ab");

    await expect(
      page.getByText("3-30 characters. Letters, numbers, and underscores only."),
    ).toBeVisible();

    await expect(username).toHaveAttribute("aria-invalid", "true");
    await expect(submit).toBeDisabled();

    await cleanupVerifications(email);
  });

  test("keeps the setup when the name is blank", async ({ page }) => {
    const email = `e2e-setup-blank-${Date.now()}@zoonk.test`;

    await signUpToSetup(page, email);

    const name = page.getByRole("textbox", { exact: true, name: "Name" });
    await name.fill("   ");
    await name.evaluate((input) => input.closest("form")?.setAttribute("novalidate", ""));
    await page.getByRole("button", { name: /^continue$/iu }).click();

    await expect(page.getByText("We couldn't save your profile. Try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/setup/u);

    await cleanupVerifications(email);
  });
});
