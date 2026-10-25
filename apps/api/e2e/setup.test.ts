import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";

const REDIRECT_URL = "http://localhost:49152/test";

/** Signs an email in through the code and lands on the profile setup. */
async function signInToSetup({
  email,
  page,
  redirectTo = REDIRECT_URL,
}: {
  email: string;
  page: Page;
  redirectTo?: string;
}) {
  await page.goto(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  await page.getByLabel(/email/iu).fill(email);
  await page.getByRole("button", { name: /^continue$/iu }).click();
  await page.waitForURL(/\/auth\/otp/u);

  const otp = await getOTPForEmail(email);

  if (!otp) {
    throw new Error("OTP not found in database");
  }

  // The sixth digit sends the code.
  await page.getByRole("textbox", { name: "Code from the email" }).fill(otp);

  await page.waitForURL(/\/auth\/setup/u);
}

test.describe("Profile Setup Flow", () => {
  test.afterAll(async () => {
    await disconnectDb();
  });

  test("a new account gives its name; the username starts from the email and is checked as it changes", async ({
    page,
  }) => {
    const prefix = `e2esetup${Date.now()}`;
    const email = `${prefix}@zoonk.test`;
    const chosen = `${prefix}_x`;
    // A return address ending in a slash gets the token without a second slash.
    const redirectTo = `${REDIRECT_URL}/`;

    await signInToSetup({ email, page, redirectTo });

    const name = page.getByRole("textbox", { exact: true, name: "Name" });
    const submit = page.getByRole("button", { name: /^continue$/iu });

    await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
    await expect(name).toBeFocused();

    // A blank name keeps the setup.
    await name.fill("   ");
    await name.evaluate((input) => input.closest("form")?.setAttribute("novalidate", ""));
    await submit.click();

    await expect(page.getByText("We couldn't save your profile. Try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/setup/u);

    // The username is already picked, as a line under the name, until the learner changes it.
    await expect(page.getByText(`Your username: @${prefix}`)).toBeVisible();
    await page.getByRole("button", { name: "Change username" }).click();

    const username = page.getByRole("textbox", { exact: true, name: "Username" });
    await expect(username).toHaveValue(prefix);
    await expect(username).toBeFocused();

    // A taken or badly formed username says why and waits for a good one.
    await username.fill("admin");
    await expect(page.getByText("admin is already taken")).toBeVisible();
    await expect(submit).toBeDisabled();

    await username.fill("ab");

    await expect(
      page.getByText("3-30 characters. Letters, numbers, and underscores only."),
    ).toBeVisible();

    await expect(username).toHaveAttribute("aria-invalid", "true");
    await expect(submit).toBeDisabled();

    await name.fill("Test User");
    await username.fill(chosen);
    await expect(page.getByText(`${chosen} is available`)).toBeVisible();

    const redirectPromise = page.waitForRequest((req) => {
      const url = req.url();
      return url.startsWith(redirectTo) && new URL(url).searchParams.has("token");
    });

    await submit.click();

    const redirectRequest = await redirectPromise;
    const redirectUrl = new URL(redirectRequest.url());

    expect(`${redirectUrl.origin}${redirectUrl.pathname}`).toBe(redirectTo);
    expect(redirectUrl.searchParams.get("token")).toBeTruthy();

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject({
      name: "Test User",
      username: chosen,
    });

    await cleanupVerifications(email);
  });

  test("revisiting the callback writes nothing; a named account without a username confirms one on the setup", async ({
    page,
  }) => {
    const prefix = `e2enamed${Date.now()}`;
    const email = `${prefix}@zoonk.test`;
    const callback = `/auth/callback?redirectTo=${encodeURIComponent(REDIRECT_URL)}`;
    const unnamed = { displayUsername: null, name: "Named Learner", username: null };

    // Named, without a username: a native sign-up that left its setup, or one whose username was taken.
    await prisma.user.create({ data: { email, emailVerified: true, name: "Named Learner" } });

    await signInToSetup({ email, page });

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject(
      unnamed,
    );

    // Opening the callback again only sends the account back to its setup.
    await page.goto(callback);
    await page.waitForURL(/\/auth\/setup/u);

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject(
      unnamed,
    );

    await expect(page.getByRole("textbox", { exact: true, name: "Name" })).toHaveValue(
      "Named Learner",
    );

    await expect(page.getByText(`Your username: @${prefix}`)).toBeVisible();

    const handoff = page.waitForRequest((req) => {
      const url = req.url();
      return url.startsWith(REDIRECT_URL) && new URL(url).searchParams.has("token");
    });

    await page.getByRole("button", { name: /^continue$/iu }).click();
    await handoff;

    const saved = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(saved).toMatchObject({ name: "Named Learner", username: prefix });

    // A finished account opening the callback again is handed over again, and nothing changes.
    const again = await page.request.get(callback, { maxRedirects: 0 });
    const location = new URL(again.headers().location ?? "", REDIRECT_URL);

    expect(again.status()).toBe(307);
    expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URL);
    expect(location.searchParams.get("token")).toBeTruthy();

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toStrictEqual(saved);

    await cleanupVerifications(email);
  });
});
