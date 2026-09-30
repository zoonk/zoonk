import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth/minimal";
import { checkBotId } from "botid/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BETTER_AUTH_BASE_PATH } from "../config";
import { createEmailOTPPlugin } from "../email-otp-plugin";
import { NativeAuthResponseError, getAuthError } from "../errors";
import { baseAuthConfig } from "../server";
import { botCheckPlugin } from "./bot-check";
import { guestPlugin } from "./guest";

/** BotID only answers on Vercel, and email delivery needs Next's request context. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));
vi.mock("./otp", () => ({ sendVerificationOTP: vi.fn() }));

const BASE_URL = "http://localhost:3000";

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: BASE_URL,
  plugins: [botCheckPlugin(), createEmailOTPPlugin({ storeOTP: "plain" }), guestPlugin()],
  rateLimit: { enabled: false },
  secret: "bot-check-test-secret-with-enough-entropy",
  socialProviders: { google: { clientId: "test-client", clientSecret: "test-secret" } },
});

function verdict({ isBot }: { isBot: boolean }) {
  vi.mocked(checkBotId).mockResolvedValue({
    bypassed: false,
    isBot,
    isHuman: !isBot,
    isVerifiedBot: false,
  });
}

/** A browser request to Better Auth's HTTP boundary, where the captcha plugin runs. */
function post(path: string, body: unknown) {
  return auth.handler(
    new Request(`${BASE_URL}${BETTER_AUTH_BASE_PATH}${path}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin: BASE_URL },
      method: "POST",
    }),
  );
}

async function readCode(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  return typeof body === "object" && body && "code" in body ? body.code : null;
}

const email = () => `bot-check-${randomUUID()}@example.test`;

describe("bot check on auth requests", () => {
  beforeEach(() => {
    vi.mocked(checkBotId).mockReset();
    verdict({ isBot: true });
  });

  it("refuses every request that makes a session or sends a code when BotID sees a bot", async () => {
    const responses = await Promise.all([
      post("/sign-in/anonymous", {}),
      post("/email-otp/send-verification-otp", { email: email(), type: "sign-in" }),
      post("/sign-in/email-otp", { email: email(), otp: "123456" }),
      post("/sign-in/social", { callbackURL: "/", provider: "google" }),
    ]);

    expect(responses.map((response) => response.status)).toStrictEqual([403, 403, 403, 403]);

    const codes = await Promise.all(responses.map((response) => readCode(response)));
    expect(codes).toStrictEqual(Array.from({ length: 4 }, () => "VERIFICATION_FAILED"));
  });

  it("makes a guest and sends a code for a person", async () => {
    verdict({ isBot: false });

    const [guest, code] = await Promise.all([
      post("/sign-in/anonymous", {}),
      post("/email-otp/send-verification-otp", { email: email(), type: "sign-in" }),
    ]);

    expect([guest.status, code.status]).toStrictEqual([200, 200]);
  });

  it("lets a native app sign in with a provider's ID token, which BotID can't see", async () => {
    const response = await post("/sign-in/social", {
      idToken: { token: "not-a-real-token" },
      provider: "google",
    });

    // The token itself is checked next: this one is refused, but never as a bot.
    expect(response.status).not.toBe(403);
    await expect(readCode(response)).resolves.not.toBe("VERIFICATION_FAILED");
  });

  it("leaves other auth requests alone", async () => {
    const response = await auth.handler(
      new Request(`${BASE_URL}${BETTER_AUTH_BASE_PATH}/get-session`, { method: "GET" }),
    );

    expect(response.status).toBe(200);
    expect(checkBotId).not.toHaveBeenCalled();
  });
});

describe("the bot check's error", () => {
  it("reaches apps as BOT_DETECTED, the product's code", () => {
    const error = new NativeAuthResponseError({
      body: { code: "VERIFICATION_FAILED", message: "Captcha verification failed" },
      statusCode: 403,
    });

    expect(getAuthError(error)).toMatchObject({ code: "BOT_DETECTED", statusCode: 403 });
  });
});
