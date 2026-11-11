import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createGuest } from "./route";

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

  const { guestPlugin } = await import("../../../../../../packages/auth/src/plugins/guest");

  return {
    auth: betterAuth({
      ...baseAuthConfig,
      advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
      plugins: [...baseAuthPlugins, bearer(), guestPlugin()],
      rateLimit: { enabled: true, storage: "database" },
      secret: "guest-api-test-secret-with-enough-entropy",
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

function createGuestRequest(headers: Headers) {
  return new NextRequest(`${BASE_URL}/v1/guests`, {
    body: JSON.stringify({}),
    headers,
    method: "POST",
  });
}

describe("guests through the API", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    const response = await createGuest(createGuestRequest(phoneHeaders(extra)));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ token: expect.any(String) });
  });
});
