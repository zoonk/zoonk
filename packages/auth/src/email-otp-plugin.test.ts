import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BETTER_AUTH_BASE_PATH } from "./config";
import { createEmailOTPPlugin } from "./email-otp-plugin";
import { baseAuthConfig } from "./server";

/** The codes "sent" by email, by address, so tests can type them. */
const sent = vi.hoisted(() => new Map<string, string>());

vi.mock("./plugins/otp", () => ({
  sendVerificationOTP: vi.fn(async ({ email, otp }: { email: string; otp: string }) => {
    sent.set(email, otp);
  }),
}));

const BASE_URL = "http://localhost:3000";

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: BASE_URL,
  plugins: [createEmailOTPPlugin({ storeOTP: "plain" })],
  rateLimit: { enabled: false },
  secret: "email-otp-plugin-test-secret-with-enough-entropy",
});

const testEmails: string[] = [];

function post(path: string, body: object) {
  return auth.handler(
    new Request(`${BASE_URL}${BETTER_AUTH_BASE_PATH}${path}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin: BASE_URL },
      method: "POST",
    }),
  );
}

function signIn({ email, otp }: { email: string; otp: string }) {
  return post("/sign-in/email-otp", { email, otp });
}

describe("email sign-in codes", () => {
  afterEach(async () => {
    await Promise.all([
      prisma.user.deleteMany({ where: { email: { in: testEmails } } }),
      prisma.verification.deleteMany({
        where: { identifier: { in: testEmails.map((email) => `sign-in-otp-${email}`) } },
      }),
    ]);

    testEmails.length = 0;
  });

  it("deletes a code after Better Auth's three wrong tries, so guessing gets nowhere", async () => {
    const email = `learner-${randomUUID()}@example.test`;
    testEmails.push(email);

    await post("/email-otp/send-verification-otp", { email, type: "sign-in" });
    const code = sent.get(email) ?? "";
    const wrong = code === "000000" ? "111111" : "000000";

    // One at a time: Better Auth turns away a try made while another is checked, without counting it.
    const first = await signIn({ email, otp: wrong });
    const second = await signIn({ email, otp: wrong });
    const third = await signIn({ email, otp: wrong });
    expect([first.status, second.status, third.status]).toStrictEqual([400, 400, 400]);

    const right = await signIn({ email, otp: code });
    expect(right.status).toBe(403);
    await expect(right.json()).resolves.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
  });
});
