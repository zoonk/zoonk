import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins";
import { checkBotId } from "botid/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BETTER_AUTH_BASE_PATH } from "./config";
import { createEmailOTPPlugin } from "./email-otp-plugin";
import { botCheckPlugin } from "./plugins/bot-check";
import { guestPlugin } from "./plugins/guest";
import { sendVerificationOTP } from "./plugins/otp";
import { baseAuthConfig, baseAuthPlugins } from "./server";

/** BotID requires Vercel and email delivery requires Next's request context. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));
vi.mock("./plugins/otp", () => ({ sendVerificationOTP: vi.fn() }));

const BASE_URL = "http://localhost:3000";
const SEND_PATH = "/email-otp/send-verification-otp";

const auth = betterAuth({
  ...baseAuthConfig,
  /** Better Auth's test mode otherwise disables origin checks even with a production bot verdict. */
  advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
  baseURL: BASE_URL,
  plugins: [
    ...baseAuthPlugins,
    botCheckPlugin(),
    createEmailOTPPlugin({ storeOTP: "hashed" }),
    bearer(),
    guestPlugin(),
  ],
  rateLimit: { enabled: true, storage: "database" },
  secret: "native-email-reauthentication-test-secret",
});

async function learner({ expired = false, isAnonymous = false, banned = false } = {}) {
  const token = randomUUID();

  const user = await prisma.user.create({
    data: {
      banned,
      email: `native-reauthentication-${randomUUID()}@example.test`,
      emailVerified: true,
      isAnonymous,
      name: "Native Learner",
      sessions: {
        create: {
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + (expired ? -60_000 : 24 * 60 * 60 * 1000)),
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

function rejectedToken({ kind, token }: { kind: string; token: string }) {
  if (kind === "missing") {
    return;
  }

  if (kind === "invalid") {
    return randomUUID();
  }

  return token;
}

describe("native email reauthentication under the production BotID guard", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");

    vi.mocked(checkBotId).mockResolvedValue({
      bypassed: false,
      isBot: true,
      isHuman: false,
      isVerifiedBot: false,
    });

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

  it.each(["missing", "other account", "invalid", "expired", "revoked", "guest", "banned"])(
    "refuses a code request with a %s token before delivery",
    async (kind) => {
      const user = await learner();

      const other = await learner({
        banned: kind === "banned",
        expired: kind === "expired",
        isAnonymous: kind === "guest",
      });

      const token = rejectedToken({ kind, token: other.token });

      const email = kind === "other account" || kind === "missing" ? user.email : other.email;

      if (kind === "revoked") {
        await prisma.session.delete({ where: { token: other.token } });
      }

      const response = await nativePost({
        body: { email, type: "sign-in" },
        headers: bearerHeaders(token),
      });

      expect(response.status).toBe(403);
      expect(sendVerificationOTP).not.toHaveBeenCalled();

      await expect(
        prisma.verification.count({ where: { identifier: `sign-in-otp-${email}` } }),
      ).resolves.toBe(0);
    },
  );

  it("never exempts OTP login or other email-code purposes", async () => {
    const user = await learner();

    const responses = await Promise.all([
      nativePost({
        body: { email: user.email, type: "forget-password" },
        headers: bearerHeaders(user.token),
      }),
      nativePost({
        body: { email: user.email, type: "email-verification" },
        headers: bearerHeaders(user.token),
      }),
      nativePost({
        body: { email: user.email, otp: "123456" },
        headers: bearerHeaders(user.token),
        path: "/sign-in/email-otp",
      }),
    ]);

    expect(responses.map((response) => response.status)).toStrictEqual([403, 403, 403]);
    expect(sendVerificationOTP).not.toHaveBeenCalled();
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

  it("doesn't fall back to a valid cookie when the bearer is invalid or missing", async () => {
    const user = await learner();

    const signedSession = await auth.api.getSession({
      headers: bearerHeaders(user.token),
      returnHeaders: true,
    });

    const cookie = signedSession.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

    const responses = await Promise.all(
      [undefined, "invalid-token"].map((token) => {
        const headers = bearerHeaders(token);
        headers.set("cookie", cookie);
        headers.set("origin", BASE_URL);
        return nativePost({ body: { email: user.email, type: "sign-in" }, headers });
      }),
    );

    expect(responses.map((response) => response.status)).toStrictEqual([403, 403]);
    expect(sendVerificationOTP).not.toHaveBeenCalled();
  });

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
