import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { holdScripts } from "@zoonk/e2e/hydration";
import { cleanupVerifications, disconnectDb, getOTPForEmail } from "./helpers/db";
import { clickWithConnectionDown } from "./helpers/server-actions";
import { E2E_MAIN_APP_URL } from "./main-app-url";

const REDIRECT_URL = `${E2E_MAIN_APP_URL}/test`;

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
  await page.waitForURL(/\/auth\/en\/otp/u);

  const otp = await getOTPForEmail(email);

  if (!otp) {
    throw new Error("OTP not found in database");
  }

  await page.getByRole("textbox", { name: "Code from the email" }).fill(otp);

  await page.waitForURL(/\/auth\/en\/setup/u);
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
    const redirectTo = `${REDIRECT_URL}/`;

    await signInToSetup({ email, page, redirectTo });

    const name = page.getByRole("textbox", { exact: true, name: "Name" });
    const submit = page.getByRole("button", { name: /^continue$/iu });

    await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();

    await name.fill("   ");
    await name.evaluate((input) => input.closest("form")?.setAttribute("novalidate", ""));
    await submit.click();

    await expect(page.getByText("We couldn't save your profile. Try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/en\/setup/u);

    await expect(page.getByText(`Your username: @${prefix}`)).toBeVisible();
    await page.getByRole("button", { name: "Change username" }).click();

    const username = page.getByRole("textbox", { exact: true, name: "Username" });
    await expect(username).toHaveValue(prefix);

    await username.fill("admin");
    await expect(page.getByText("admin is already taken")).toBeVisible();
    await expect(submit).toBeDisabled();

    await username.fill("ab");

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

  test("a name typed and sent before the page loaded stays when another learner took the username meanwhile", async ({
    page,
  }) => {
    const prefix = `e2eearly${Date.now()}`;
    const email = `${prefix}@zoonk.test`;

    await signInToSetup({ email, page });

    const loadScripts = await holdScripts(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(`Your username: @${prefix}`)).toBeVisible();

    await prisma.user.create({
      data: { email: `other-${email}`, emailVerified: true, name: "Other", username: prefix },
    });

    const name = page.getByRole("textbox", { exact: true, name: "Name" });
    await name.fill("Early Learner");
    await page.getByRole("button", { name: /^continue$/iu }).click();
    await loadScripts();

    await expect(page.getByText(`${prefix} is already taken`)).toBeVisible();
    await expect(name).toHaveValue("Early Learner");
    await expect(page.getByRole("textbox", { exact: true, name: "Username" })).toHaveValue(prefix);

    await cleanupVerifications(email);
  });

  test("revisiting the callback writes nothing; a named account without a username confirms one on the setup, after a dropped connection", async ({
    page,
  }) => {
    const prefix = `e2enamed${Date.now()}`;
    const email = `${prefix}@zoonk.test`;
    const callback = `/auth/callback?redirectTo=${encodeURIComponent(REDIRECT_URL)}`;
    const unnamed = { name: "Named Learner", username: null };

    await prisma.user.create({ data: { email, emailVerified: true, name: "Named Learner" } });

    await signInToSetup({ email, page });

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject(
      unnamed,
    );

    await page.goto(callback);
    await page.waitForURL(/\/auth\/en\/setup/u);

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject(
      unnamed,
    );

    const name = page.getByRole("textbox", { exact: true, name: "Name" });
    const submit = page.getByRole("button", { name: /^continue$/iu });
    await expect(name).toHaveValue("Named Learner");

    await clickWithConnectionDown(submit);
    await expect(page.getByText("We couldn't save your profile. Try again.")).toBeVisible();
    await expect(name).toHaveValue("Named Learner");

    const handoff = page.waitForRequest((req) => {
      const url = req.url();
      return url.startsWith(REDIRECT_URL) && new URL(url).searchParams.has("token");
    });

    await submit.click();
    await handoff;

    const saved = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(saved).toMatchObject({ name: "Named Learner", username: prefix });

    const again = await page.request.get(callback, { maxRedirects: 0 });
    const location = new URL(again.headers().location ?? "", REDIRECT_URL);

    expect(again.status()).toBe(307);
    expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URL);
    expect(location.searchParams.get("token")).toBeTruthy();

    await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toStrictEqual(saved);

    await cleanupVerifications(email);
  });
});
