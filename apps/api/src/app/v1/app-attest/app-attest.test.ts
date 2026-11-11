import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECORDED_APP,
  RECORDED_PRODUCTION_ATTESTATION,
} from "../../../../../../packages/auth/src/app-attest/_test-utils/recorded-attestations";
import { POST as createGuest } from "../guests/route";
import { POST as createKey } from "./keys/route";

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

  const { guestPlugin } = await import("../../../../../../packages/auth/src/plugins/guest");

  return {
    auth: betterAuth({
      ...baseAuthConfig,
      advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
      plugins: [...baseAuthPlugins, appAttestPlugin(), bearer(), guestPlugin()],
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

describe("App Attest through the API", () => {
  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");
    vi.stubEnv("APPLE_TEAM_ID", RECORDED_APP.teamIdentifier);
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", RECORDED_APP.bundleIdentifier);

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

  it.each<Record<string, string>>([
    {},
    {
      "x-app-attest-assertion": "obsolete",
      "x-app-attest-challenge": "obsolete",
      "x-app-attest-key-id": "obsolete",
      "x-play-integrity-challenge": "obsolete",
      "x-play-integrity-token": "obsolete",
    },
  ])("makes a guest without proof or with obsolete proof headers: %j", async (extra) => {
    const response = await createGuest(
      post({ body: {}, headers: phoneHeaders(extra), path: "/guests" }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ token: expect.any(String) });
  });
});
