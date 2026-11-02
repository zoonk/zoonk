import { createHash, randomUUID } from "node:crypto";
import { checkBotId } from "botid/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodePlayIntegrityToken } from "../../../../../../packages/auth/src/play-integrity/decode-play-integrity-token";
import { sendVerificationOTP } from "../../../../../../packages/auth/src/plugins/otp";
import { POST as sendEmailCode } from "../email-sign-in-codes/route";
import { POST as createGuest } from "../guests/route";
import { POST as createEmailCodeSession } from "../sessions/email-code/route";
import { POST as createChallenge } from "./challenges/route";

/** BotID, email delivery and Google's decode are the only boundaries replaced. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));

vi.mock("../../../../../../packages/auth/src/plugins/otp", () => ({
  sendVerificationOTP: vi.fn(),
}));

vi.mock("../../../../../../packages/auth/src/play-integrity/decode-play-integrity-token", () => ({
  decodePlayIntegrityToken: vi.fn(),
}));

vi.mock("@zoonk/auth", async () => {
  const { createRequire } = await import("node:module");
  /** Better Auth belongs to the auth workspace; don't add it to API just for this harness. */
  const authRequire = createRequire(
    new URL("../../../../../../packages/auth/package.json", import.meta.url),
  );

  const { betterAuth } = await import(authRequire.resolve("better-auth/minimal"));
  const { bearer } = await import(authRequire.resolve("better-auth/plugins"));

  const { baseAuthConfig, baseAuthPlugins } =
    await import("../../../../../../packages/auth/src/server");

  const { appAttestPlugin } =
    await import("../../../../../../packages/auth/src/plugins/app-attest");

  const { botCheckPlugin } = await import("../../../../../../packages/auth/src/plugins/bot-check");
  const { guestPlugin } = await import("../../../../../../packages/auth/src/plugins/guest");

  const { createEmailOTPPlugin } =
    await import("../../../../../../packages/auth/src/email-otp-plugin");

  return {
    auth: betterAuth({
      ...baseAuthConfig,
      advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
      plugins: [
        ...baseAuthPlugins,
        botCheckPlugin(),
        appAttestPlugin(),
        createEmailOTPPlugin({ storeOTP: "hashed" }),
        bearer(),
        guestPlugin(),
      ],
      rateLimit: { enabled: true, storage: "database" },
      secret: "play-integrity-api-test-secret-with-enough-entropy",
    }),
  };
});

const BASE_URL = "http://localhost:9002";

/** Each test is its own phone, so Better Auth's per-IP limits don't carry over. */
function phoneHeaders(extra: Record<string, string> = {}) {
  const bytes = randomUUID().replaceAll("-", "");

  return new Headers({
    "content-type": "application/json",
    "x-forwarded-for": `15.${Number.parseInt(bytes.slice(0, 2), 16)}.${Number.parseInt(bytes.slice(2, 4), 16)}.${Number.parseInt(bytes.slice(4, 6), 16)}`,
    ...extra,
  });
}

function post({ body, headers, path }: { body: unknown; headers: Headers; path: string }) {
  return new NextRequest(`${BASE_URL}/v1${path}`, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
}

async function playIntegrityHeaders(operation: string, fields: string[] = []) {
  const response = await createChallenge(
    post({ body: {}, headers: phoneHeaders(), path: "/app-attest/challenges" }),
  );

  const { challenge } = (await response.json()) as { challenge: string };
  const clientData = ["zoonk-app-attest:1", challenge, operation, ...fields].join("\n");

  vi.mocked(decodePlayIntegrityToken).mockResolvedValueOnce({
    appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED" },
    deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"] },
    requestDetails: {
      requestHash: createHash("sha256").update(clientData).digest("base64url"),
      requestPackageName: "com.zoonk",
    },
  });

  return phoneHeaders({
    "x-play-integrity-challenge": challenge,
    "x-play-integrity-token": `play-integrity-token-${randomUUID()}`,
  });
}

describe("Play Integrity through the API", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");
    vi.mocked(decodePlayIntegrityToken).mockReset();
    vi.mocked(sendVerificationOTP).mockReset();

    vi.mocked(checkBotId).mockResolvedValue({
      bypassed: false,
      isBot: true,
      isHuman: false,
      isVerifiedBot: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("makes a guest for the Android app's token and refuses one without proof", async () => {
    const proven = await createGuest(
      post({ body: {}, headers: await playIntegrityHeaders("guest"), path: "/guests" }),
    );

    expect(proven.status).toBe(201);
    await expect(proven.json()).resolves.toMatchObject({ token: expect.any(String) });

    const unproven = await createGuest(
      post({ body: {}, headers: phoneHeaders(), path: "/guests" }),
    );

    expect(unproven.status).toBe(403);
    await expect(unproven.json()).resolves.toMatchObject({ error: { code: "BOT_DETECTED" } });
  });

  it("sends a code and signs in with it, each with its own token", async () => {
    const email = `play-integrity-${randomUUID()}@example.test`;

    const sent = await sendEmailCode(
      post({
        body: { email },
        headers: await playIntegrityHeaders("email-code", [email]),
        path: "/email-sign-in-codes",
      }),
    );

    expect(sent.status).toBe(204);

    const code = vi.mocked(sendVerificationOTP).mock.calls[0]?.[0].otp ?? "";

    const session = await createEmailCodeSession(
      post({
        body: { code, email },
        headers: await playIntegrityHeaders("email-session", [email, code]),
        path: "/sessions/email-code",
      }),
    );

    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({ token: expect.any(String) });
  });

  it("refuses a code for another email than the token was made for", async () => {
    const email = `play-integrity-${randomUUID()}@example.test`;

    const response = await sendEmailCode(
      post({
        body: { email: `someone-else-${randomUUID()}@example.test` },
        headers: await playIntegrityHeaders("email-code", [email]),
        path: "/email-sign-in-codes",
      }),
    );

    expect(response.status).toBe(403);
    expect(sendVerificationOTP).not.toHaveBeenCalled();
  });
});
