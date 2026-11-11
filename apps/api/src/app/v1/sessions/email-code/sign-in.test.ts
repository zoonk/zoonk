import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendVerificationOTP } from "../../../../../../../packages/auth/src/plugins/otp";
import { POST as sendEmailCode } from "../../email-sign-in-codes/route";
import { POST as createEmailCodeSession } from "./route";

/** Email delivery needs Next's request context. */
vi.mock("../../../../../../../packages/auth/src/plugins/otp", () => ({
  sendVerificationOTP: vi.fn(),
}));

vi.mock("@zoonk/auth", async () => {
  const { createRequire } = await import("node:module");
  /** Better Auth belongs to the auth workspace; don't add it to API just for this harness. */
  const authRequire = createRequire(
    new URL("../../../../../../../packages/auth/package.json", import.meta.url),
  );

  const { betterAuth } = await import(authRequire.resolve("better-auth/minimal"));
  const { bearer } = await import(authRequire.resolve("better-auth/plugins"));

  const { baseAuthConfig, baseAuthPlugins } =
    await import("../../../../../../../packages/auth/src/server");

  const { appAttestPlugin } =
    await import("../../../../../../../packages/auth/src/plugins/app-attest");

  const { guestPlugin } = await import("../../../../../../../packages/auth/src/plugins/guest");

  const { createEmailOTPPlugin } =
    await import("../../../../../../../packages/auth/src/email-otp-plugin");

  return {
    auth: betterAuth({
      ...baseAuthConfig,
      advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
      plugins: [
        ...baseAuthPlugins,
        appAttestPlugin(),
        createEmailOTPPlugin({ storeOTP: "hashed" }),
        bearer(),
        guestPlugin(),
      ],
      rateLimit: { enabled: true, storage: "database" },
      secret: "email-sign-in-api-test-secret-with-enough-entropy",
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

describe("Email sign-in without app proof", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");
    vi.mocked(sendVerificationOTP).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends a code and signs in without attestation", async () => {
    const email = `play-integrity-${randomUUID()}@example.test`;

    const sent = await sendEmailCode(
      post({ body: { email }, headers: phoneHeaders(), path: "/email-sign-in-codes" }),
    );

    expect(sent.status).toBe(204);

    const code = vi.mocked(sendVerificationOTP).mock.calls[0]?.[0].otp ?? "";

    const session = await createEmailCodeSession(
      post({ body: { code, email }, headers: phoneHeaders(), path: "/sessions/email-code" }),
    );

    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({ token: expect.any(String) });
  });
});
