import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { checkBotId } from "botid/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeAssertion,
  makeDeviceKey,
} from "../../../../../../packages/auth/src/app-attest/_test-utils/assertion";
import {
  RECORDED_APP,
  RECORDED_PRODUCTION_ATTESTATION,
} from "../../../../../../packages/auth/src/app-attest/_test-utils/recorded-attestations";
import { POST as createGuest } from "../guests/route";
import { POST as createChallenge } from "./challenges/route";
import { POST as createKey } from "./keys/route";

/** Real auth and persistence; only Vercel BotID is external, and it always sees a bot here. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));

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

  return {
    auth: betterAuth({
      ...baseAuthConfig,
      advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
      plugins: [...baseAuthPlugins, botCheckPlugin(), appAttestPlugin(), bearer(), guestPlugin()],
      rateLimit: { enabled: true, storage: "database" },
      secret: "app-attest-api-test-secret-with-enough-entropy",
    }),
  };
});

const BASE_URL = "http://localhost:9002";

/** Each test is its own phone, so Better Auth's per-IP limits don't carry over. */
function phoneHeaders(extra: Record<string, string> = {}) {
  const bytes = randomUUID().replaceAll("-", "");

  return new Headers({
    "content-type": "application/json",
    "x-forwarded-for": `14.${Number.parseInt(bytes.slice(0, 2), 16)}.${Number.parseInt(bytes.slice(2, 4), 16)}.${Number.parseInt(bytes.slice(4, 6), 16)}`,
    ...extra,
  });
}

function post({
  body,
  headers = phoneHeaders(),
  path,
}: {
  body?: unknown;
  headers?: Headers;
  path: string;
}) {
  return new NextRequest(`${BASE_URL}/v1${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    method: "POST",
  });
}

async function issueChallenge(headers: Headers) {
  const response = await createChallenge(post({ headers, path: "/app-attest/challenges" }));
  const body: unknown = await response.json();

  expect(response.status).toBe(201);
  expect(body).toMatchObject({ challenge: expect.any(String) });

  return (body as { challenge: string }).challenge;
}

describe("App Attest through the API", () => {
  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");
    vi.stubEnv("APPLE_TEAM_ID", RECORDED_APP.teamIdentifier);
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", RECORDED_APP.bundleIdentifier);

    vi.mocked(checkBotId).mockResolvedValue({
      bypassed: false,
      isBot: true,
      isHuman: false,
      isVerifiedBot: false,
    });

    await prisma.appAttestKey.deleteMany({
      where: { keyId: RECORDED_PRODUCTION_ATTESTATION.keyId },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers an attested key once per challenge", async () => {
    await prisma.verification.create({
      data: {
        expiresAt: new Date(Date.now() + 60_000),
        identifier: `app-attest-challenge:${RECORDED_PRODUCTION_ATTESTATION.challenge}`,
        value: "app-attest",
      },
    });

    const registered = await createKey(
      post({ body: RECORDED_PRODUCTION_ATTESTATION, path: "/app-attest/keys" }),
    );

    expect(registered.status).toBe(204);

    const again = await createKey(
      post({ body: RECORDED_PRODUCTION_ATTESTATION, path: "/app-attest/keys" }),
    );

    expect(again.status).toBe(400);

    await expect(again.json()).resolves.toMatchObject({
      error: { code: "APP_ATTESTATION_INVALID" },
    });
  });

  it("refuses a malformed key request before reaching auth", async () => {
    const response = await createKey(
      post({ body: { attestation: "not base64!", keyId: "x" }, path: "/app-attest/keys" }),
    );

    expect(response.status).toBe(400);
  });

  it("makes a guest for the iOS app's assertion and refuses one without proof", async () => {
    const key = makeDeviceKey();
    await prisma.appAttestKey.create({ data: { keyId: key.keyId, publicKey: key.publicKey } });

    const headers = phoneHeaders();
    const challenge = await issueChallenge(headers);

    const attested = await createGuest(
      post({
        body: {},
        headers: phoneHeaders({
          "x-app-attest-assertion": makeAssertion({
            challenge,
            counter: 1,
            privateKey: key.privateKey,
          }),
          "x-app-attest-challenge": challenge,
          "x-app-attest-key-id": key.keyId,
        }),
        path: "/guests",
      }),
    );

    expect(attested.status).toBe(201);
    await expect(attested.json()).resolves.toMatchObject({ token: expect.any(String) });

    const unproven = await createGuest(post({ body: {}, path: "/guests" }));

    expect(unproven.status).toBe(403);
    await expect(unproven.json()).resolves.toMatchObject({ error: { code: "BOT_DETECTED" } });
  });
});
