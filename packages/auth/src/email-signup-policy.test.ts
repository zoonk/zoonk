import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailOTPPlugin } from "./email-otp-plugin";
import { baseAuthConfig } from "./server";

/** Email delivery requires Next's request context; authentication and persistence stay real. */
vi.mock("./plugins/otp", () => ({ sendVerificationOTP: vi.fn() }));

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: "http://localhost:3000",
  plugins: [createEmailOTPPlugin({ storeOTP: "plain" })],
  rateLimit: { enabled: false },
  secret: "disposable-email-signup-policy-test-secret",
});

const testEmails: string[] = [];

function createEmail(domain: string) {
  const email = `email-policy-${randomUUID()}@${domain}`;
  testEmails.push(email);
  return email;
}

async function readOTP(email: string) {
  const { otp } = await auth.api.getVerificationOTP({ query: { email, type: "sign-in" } });

  if (!otp) {
    throw new Error("Expected a stored sign-in OTP");
  }

  return otp;
}

describe("email signup policy", () => {
  afterEach(async () => {
    await Promise.all([
      prisma.user.deleteMany({ where: { email: { in: testEmails } } }),
      prisma.verification.deleteMany({
        where: { identifier: { in: testEmails.map((email) => `sign-in-otp-${email}`) } },
      }),
    ]);

    testEmails.length = 0;
  });

  it("rejects a new disposable email before storing or sending an OTP", async () => {
    const email = createEmail("mailinator.com");

    await expect(
      auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } }),
    ).rejects.toMatchObject({ body: { code: "DISPOSABLE_EMAIL_NOT_ALLOWED" }, statusCode: 400 });

    await expect(
      prisma.verification.findFirst({ where: { identifier: `sign-in-otp-${email}` } }),
    ).resolves.toBeNull();
  });

  it("rejects account creation even when the disposable email already has a valid OTP", async () => {
    const email = createEmail("yopmail.com");
    const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });

    await expect(auth.api.signInEmailOTP({ body: { email, otp } })).rejects.toMatchObject({
      body: { code: "DISPOSABLE_EMAIL_NOT_ALLOWED" },
      statusCode: 400,
    });

    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
  });

  it("allows an existing disposable-email user to request an OTP and sign in", async () => {
    const email = createEmail("mailinator.com");

    const user = await prisma.user.create({
      data: { email, emailVerified: true, name: "Existing learner" },
    });

    await expect(
      auth.api.sendVerificationOTP({ body: { email: email.toUpperCase(), type: "sign-in" } }),
    ).resolves.toStrictEqual({ success: true });

    const otp = await readOTP(email);
    const session = await auth.api.signInEmailOTP({ body: { email, otp } });

    expect(session.user.id).toBe(user.id);

    await expect(
      prisma.session.findUnique({ where: { token: session.token } }),
    ).resolves.toMatchObject({ userId: user.id });
  });

  it.each([
    "icloud.com",
    "privaterelay.appleid.com",
    "private.icloud.com",
    "duck.com",
    "mozmail.com",
    "simplelogin.co",
    "slmail.me",
    "learner.anonaddy.com",
  ])("allows signup with a privacy alias on %s", async (domain) => {
    const email = createEmail(domain);

    await expect(
      auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } }),
    ).resolves.toStrictEqual({ success: true });

    const otp = await readOTP(email);
    const session = await auth.api.signInEmailOTP({ body: { email, otp } });

    expect(session.user.email).toBe(email);

    await expect(
      prisma.userProgress.findUnique({ where: { userId: session.user.id } }),
    ).resolves.not.toBeNull();
  });
});
