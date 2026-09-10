import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cleanupVerifications, getOTPForEmail } from "./helpers/db";

const testEmails: string[] = [];

function createEmail(domain: string) {
  const email = `signup-policy-${randomUUID()}@${domain}`;
  testEmails.push(email);
  return email;
}

test.afterEach(async () => {
  await Promise.all([
    ...testEmails.map((email) => cleanupVerifications(email)),
    prisma.user.deleteMany({ where: { email: { in: testEmails } } }),
  ]);

  testEmails.length = 0;
});

test("shows a recoverable disposable-email error and accepts an Apple privacy alias", async ({
  page,
}) => {
  const disposableEmail = createEmail("mailinator.com");
  const appleEmail = createEmail("privaterelay.appleid.com");

  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill(disposableEmail);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page).toHaveURL(/\/auth\/login/u);

  await expect(
    page.getByText(
      "Temporary email addresses aren't supported. Use another email or a privacy alias.",
    ),
  ).toBeVisible();

  await expect(
    prisma.verification.findFirst({ where: { identifier: `sign-in-otp-${disposableEmail}` } }),
  ).resolves.toBeNull();

  await page.getByLabel("Email", { exact: true }).fill(appleEmail);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page).toHaveURL(/\/auth\/otp\?/u);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("returns a stable API error before creating an OTP for a new disposable account", async ({
  request,
}) => {
  const email = createEmail("mailinator.com");
  const response = await request.post("/v1/email-sign-in-codes", { data: { email } });

  expect(response.status()).toBe(400);

  await expect(response.json()).resolves.toMatchObject({
    error: { code: "DISPOSABLE_EMAIL_NOT_ALLOWED" },
  });

  await expect(
    prisma.verification.findFirst({ where: { identifier: `sign-in-otp-${email}` } }),
  ).resolves.toBeNull();
});

test("rejects a valid previously issued code for a new disposable account", async ({ request }) => {
  const email = createEmail("yopmail.com");
  const code = "123456";

  await prisma.verification.create({
    data: {
      expiresAt: new Date(Date.now() + 60_000),
      identifier: `sign-in-otp-${email}`,
      value: `${code}:0`,
    },
  });

  const response = await request.post("/v1/sessions/email-code", { data: { code, email } });

  expect(response.status()).toBe(400);

  await expect(response.json()).resolves.toMatchObject({
    error: { code: "DISPOSABLE_EMAIL_NOT_ALLOWED" },
  });

  await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
});

test("keeps existing disposable-email accounts accessible through the API", async ({ request }) => {
  const email = createEmail("mailinator.com");
  const user = await userFixture({ email });

  const codeResponse = await request.post("/v1/email-sign-in-codes", {
    data: { email: email.toUpperCase() },
  });

  expect(codeResponse.status()).toBe(204);
  const code = await getOTPForEmail(email);
  expect(code).not.toBeNull();

  const response = await request.post("/v1/sessions/email-code", { data: { code, email } });

  expect(response.status(), await response.text()).toBe(200);
  await expect(prisma.session.findFirst({ where: { userId: user.id } })).resolves.not.toBeNull();
});

// oxlint-disable-next-line vitest/prefer-each -- Playwright does not support test.each.
for (const domain of ["icloud.com", "privaterelay.appleid.com", "private.icloud.com", "duck.com"]) {
  test(`creates a new account with a privacy alias on ${domain}`, async ({ request }) => {
    const email = createEmail(domain);
    const codeResponse = await request.post("/v1/email-sign-in-codes", { data: { email } });
    expect(codeResponse.status()).toBe(204);

    const code = await getOTPForEmail(email);
    expect(code).not.toBeNull();
    const response = await request.post("/v1/sessions/email-code", { data: { code, email } });

    expect(response.status(), await response.text()).toBe(200);

    await expect(prisma.user.findUnique({ where: { email } })).resolves.toMatchObject({
      emailVerified: true,
    });
  });
}
