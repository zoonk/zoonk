import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { checkBotId } from "botid/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAssertion, makeDeviceKey } from "../app-attest/_test-utils/assertion";
import { RECORDED_APP } from "../app-attest/_test-utils/recorded-attestations";
import {
  APP_ATTEST_HEADERS,
  APP_ATTEST_OPERATIONS,
  type AppAttestBinding,
} from "../app-attest/app-attest-contract";
import { BETTER_AUTH_BASE_PATH } from "../config";
import { createEmailOTPPlugin } from "../email-otp-plugin";
import { NativeAuthResponseError, getAuthError } from "../errors";
import { baseAuthConfig } from "../server";
import { appAttestPlugin } from "./app-attest";
import { botCheckPlugin } from "./bot-check";
import { guestPlugin } from "./guest";

/** BotID only answers on Vercel, and email delivery needs Next's request context. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));
vi.mock("./otp", () => ({ sendVerificationOTP: vi.fn() }));

const BASE_URL = "http://localhost:3000";

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: BASE_URL,
  plugins: [
    botCheckPlugin(),
    appAttestPlugin(),
    createEmailOTPPlugin({ storeOTP: "plain" }),
    guestPlugin(),
  ],
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
function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return auth.handler(
    new Request(`${BASE_URL}${BETTER_AUTH_BASE_PATH}${path}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin: BASE_URL, ...headers },
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
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("E2E_TESTING", "false");
    vi.mocked(checkBotId).mockReset();
    verdict({ isBot: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows local auth without calling BotID when browser protection is disabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");

    const [guest, code] = await Promise.all([
      post("/sign-in/anonymous", {}),
      post("/email-otp/send-verification-otp", { email: email(), type: "sign-in" }),
    ]);

    expect([guest.status, code.status]).toStrictEqual([200, 200]);
    expect(checkBotId).not.toHaveBeenCalled();
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

  it("lets the iOS app make a guest and ask for a code with App Attest assertions", async () => {
    vi.stubEnv("APPLE_TEAM_ID", RECORDED_APP.teamIdentifier);
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", RECORDED_APP.bundleIdentifier);

    const key = makeDeviceKey();
    await prisma.appAttestKey.create({ data: { keyId: key.keyId, publicKey: key.publicKey } });

    async function attested(counter: number, binding?: AppAttestBinding) {
      const response = await post("/app-attest/challenge", {});
      const { challenge } = (await response.json()) as { challenge: string };

      return {
        [APP_ATTEST_HEADERS.assertion]: makeAssertion({
          binding,
          challenge,
          counter,
          privateKey: key.privateKey,
        }),
        [APP_ATTEST_HEADERS.challenge]: challenge,
        [APP_ATTEST_HEADERS.keyId]: key.keyId,
      };
    }

    const address = email();
    const signedFor = { fields: [address], operation: APP_ATTEST_OPERATIONS.emailCode };
    const guest = await post("/sign-in/anonymous", {}, await attested(1));

    const code = await post(
      "/email-otp/send-verification-otp",
      { email: address, type: "sign-in" },
      await attested(2, signedFor),
    );

    expect([guest.status, code.status]).toStrictEqual([200, 200]);
    expect(checkBotId).not.toHaveBeenCalled();

    // A proof signed for one email or request proves nothing for another, nor does a counter the
    // key already spent: BotID decides.
    const refused = await Promise.all([
      post(
        "/email-otp/send-verification-otp",
        { email: email(), type: "sign-in" },
        await attested(3, signedFor),
      ),
      post("/sign-in/anonymous", {}, await attested(4, signedFor)),
      post("/sign-in/anonymous", {}, await attested(2)),
    ]);

    expect(refused.map((response) => response.status)).toStrictEqual([403, 403, 403]);
  });

  it("refuses to register a key without a genuine attestation", async () => {
    vi.stubEnv("APPLE_TEAM_ID", RECORDED_APP.teamIdentifier);
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", RECORDED_APP.bundleIdentifier);

    const challengeResponse = await post("/app-attest/challenge", {});
    const { challenge } = (await challengeResponse.json()) as { challenge: string };

    const response = await post("/app-attest/key", {
      attestation: Buffer.from("not an attestation").toString("base64"),
      challenge,
      keyId: makeDeviceKey().keyId,
    });

    expect(response.status).toBe(400);
    await expect(readCode(response)).resolves.toBe("APP_ATTESTATION_INVALID");
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
