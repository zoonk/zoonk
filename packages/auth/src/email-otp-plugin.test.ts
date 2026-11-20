import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it, vi } from "vitest";
import { createEmailOTPPlugin } from "./email-otp-plugin";
import { sendVerificationOTP } from "./plugins/otp";
import { baseAuthConfig } from "./server";

/** Email delivery requires Next's request context; codes and their storage stay real. */
vi.mock("./plugins/otp", () => ({ sendVerificationOTP: vi.fn() }));

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: "http://localhost:3000",
  plugins: [createEmailOTPPlugin({ storeOTP: "encrypted" })],
  rateLimit: { enabled: false },
  secret: "email-otp-plugin-test-secret-with-enough-entropy",
});

const ALLOWED_ATTEMPTS = 3;

function createTestEmail() {
  return `email-otp-${randomUUID()}@zoonk.test`;
}

async function sendCode(email: string): Promise<string> {
  vi.mocked(sendVerificationOTP).mockClear();
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });

  const otp = vi.mocked(sendVerificationOTP).mock.calls[0]?.[0].otp;

  if (!otp) {
    throw new Error("No code was emailed");
  }

  return otp;
}

function signIn(email: string, otp: string) {
  return auth.api.signInEmailOTP({ body: { email, otp } });
}

function otherCode(otp: string) {
  return otp === "000000" ? "111111" : "000000";
}

describe("email sign-in codes", () => {
  it("emails the same code again while it's valid, so every email signs in", async () => {
    const email = createTestEmail();

    const first = await sendCode(email);
    const second = await sendCode(email);
    const third = await sendCode(email);

    expect([second, third]).toStrictEqual([first, first]);
    await expect(signIn(email, first)).resolves.toMatchObject({ user: { email } });
  });

  it("emails a new code once the last one had too many wrong tries", async () => {
    const email = createTestEmail();
    const first = await sendCode(email);

    for (let attempt = 0; attempt < ALLOWED_ATTEMPTS; attempt += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Each wrong try is counted in order.
      await expect(signIn(email, otherCode(first))).rejects.toMatchObject({
        body: { code: "INVALID_OTP" },
      });
    }

    const second = await sendCode(email);

    expect(second).not.toBe(first);
    await expect(signIn(email, second)).resolves.toMatchObject({ user: { email } });
  });
});
