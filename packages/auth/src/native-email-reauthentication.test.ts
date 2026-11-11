import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BETTER_AUTH_BASE_PATH } from "./config";
import { createEmailOTPPlugin } from "./email-otp-plugin";
import { guestPlugin } from "./plugins/guest";
import { sendVerificationOTP } from "./plugins/otp";
import { baseAuthConfig, baseAuthPlugins } from "./server";

/** Email delivery requires Next's request context. */
vi.mock("./plugins/otp", () => ({ sendVerificationOTP: vi.fn() }));

const BASE_URL = "http://localhost:3000";
const SEND_PATH = "/email-otp/send-verification-otp";

const auth = betterAuth({
  ...baseAuthConfig,
  /** Better Auth's test mode otherwise disables origin checks in this test. */
  advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
  baseURL: BASE_URL,
  plugins: [
    ...baseAuthPlugins,
    createEmailOTPPlugin({ storeOTP: "hashed" }),
    bearer(),
    guestPlugin(),
  ],
  rateLimit: { enabled: true, storage: "database" },
  secret: "native-email-reauthentication-test-secret",
});

async function learner() {
  const token = randomUUID();

  const user = await prisma.user.create({
    data: {
      email: `native-reauthentication-${randomUUID()}@example.test`,
      emailVerified: true,
      name: "Native Learner",
      sessions: {
        create: {
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          token,
        },
      },
    },
  });

  return { ...user, token };
}

function nativePost({
  body,
  headers = new Headers(),
  path = SEND_PATH,
}: {
  body: unknown;
  headers?: Headers;
  path?: string;
}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", "application/json");

  return auth.handler(
    new Request(`${BASE_URL}${BETTER_AUTH_BASE_PATH}${path}`, {
      body: JSON.stringify(body),
      headers: requestHeaders,
      method: "POST",
    }),
  );
}

function bearerHeaders(token?: string) {
  const bytes = randomUUID().replaceAll("-", "");
  const ip = `12.${Number.parseInt(bytes.slice(0, 2), 16)}.${Number.parseInt(bytes.slice(2, 4), 16)}.${Number.parseInt(bytes.slice(4, 6), 16)}`;
  return new Headers({ ...(token && { authorization: `Bearer ${token}` }), "x-forwarded-for": ip });
}

describe("native email reauthentication without sign-in attestation", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");

    vi.mocked(sendVerificationOTP).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends a code for the stale bearer owner's email without refreshing or creating a session", async () => {
    const user = await learner();
    const session = await prisma.session.findUniqueOrThrow({ where: { token: user.token } });

    const response = await nativePost({
      body: { email: user.email.toUpperCase(), type: "sign-in" },
      headers: bearerHeaders(user.token),
    });

    expect(response.status).toBe(200);
    expect(sendVerificationOTP).toHaveBeenCalledOnce();
    await expect(prisma.session.count({ where: { userId: user.id } })).resolves.toBe(1);

    await expect(
      prisma.session.findUniqueOrThrow({ where: { token: user.token } }),
    ).resolves.toMatchObject({ createdAt: session.createdAt, expiresAt: session.expiresAt });
  });

  it.each(["missing", "untrusted"])(
    "keeps browser origin checks for an authenticated send with a %s origin",
    async (kind) => {
      const user = await learner();
      const headers = bearerHeaders(user.token);
      headers.set("sec-fetch-mode", "cors");

      if (kind === "untrusted") {
        headers.set("origin", "http://untrusted.test");
      }

      const response = await nativePost({ body: { email: user.email, type: "sign-in" }, headers });

      expect(response.status).toBe(403);
      expect(sendVerificationOTP).not.toHaveBeenCalled();
    },
  );

  it("preserves Better Auth's three-per-minute send limit", async () => {
    const user = await learner();
    const headers = bearerHeaders(user.token);
    const input = { body: { email: user.email, type: "sign-in" }, headers };

    const responses = [
      await nativePost(input),
      await nativePost(input),
      await nativePost(input),
      await nativePost(input),
    ];

    expect(responses.map((response) => response.status)).toStrictEqual([200, 200, 200, 429]);
    expect(Number(responses[3]?.headers.get("x-retry-after"))).toBeGreaterThan(0);
    expect(sendVerificationOTP).toHaveBeenCalledTimes(3);
  });

  it("atomically limits concurrent authenticated sends", async () => {
    const user = await learner();
    const headers = bearerHeaders(user.token);

    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        nativePost({ body: { email: user.email, type: "sign-in" }, headers }),
      ),
    );

    expect(
      responses.map((response) => response.status).toSorted((first, second) => first - second),
    ).toStrictEqual([200, 200, 200, 429]);

    expect(sendVerificationOTP).toHaveBeenCalledTimes(3);
  });
});
