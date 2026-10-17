import { randomUUID } from "node:crypto";
import { list } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { checkBotId } from "botid/server";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendVerificationOTP } from "../../../../../../packages/auth/src/plugins/otp";
import { DELETE as deleteCurrentAccount } from "../me/route";
import { POST as sendEmailCode } from "./route";

/** Exercise production auth/core with real persistence; only Vercel BotID and email delivery are external. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn() }));

vi.mock("../../../../../../packages/auth/src/plugins/otp", () => ({
  sendVerificationOTP: vi.fn(),
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

  const { botCheckPlugin } = await import("../../../../../../packages/auth/src/plugins/bot-check");
  const { guestPlugin } = await import("../../../../../../packages/auth/src/plugins/guest");

  const { createEmailOTPPlugin } =
    await import("../../../../../../packages/auth/src/email-otp-plugin");

  const { createEmailDeletionReauthentication } =
    await import("../../../../../../packages/auth/src/email-deletion-reauthentication");

  return {
    auth: betterAuth({
      ...baseAuthConfig,
      /** Exercise production origin rules rather than Better Auth's implicit test-mode bypass. */
      advanced: { ...baseAuthConfig.advanced, disableOriginCheck: false },
      plugins: [
        ...baseAuthPlugins,
        botCheckPlugin(),
        createEmailOTPPlugin({ storeOTP: "hashed" }),
        bearer(),
        guestPlugin(),
      ],
      rateLimit: { enabled: true, storage: "database" },
      secret: "native-email-code-api-test-secret",
    }),
    reauthorizeEmailForAccountDeletion: createEmailDeletionReauthentication({
      rateLimit: { enabled: true, storage: "database" },
      storeOTP: "hashed",
    }),
  };
});

const BASE_URL = "http://localhost:9002";

async function emailOnlyLearner() {
  const token = randomUUID();

  const user = await prisma.user.create({
    data: {
      email: `email-deletion-api-${randomUUID()}@example.test`,
      emailVerified: true,
      name: "Email-only Learner",
      sessions: {
        create: {
          createdAt: new Date(Date.now() - 2 * 86_400_000),
          expiresAt: new Date(Date.now() + 86_400_000),
          token,
        },
      },
    },
  });

  return { ...user, token };
}

function nativeHeaders(token?: string) {
  const bytes = randomUUID().replaceAll("-", "");

  return new Headers({
    ...(token && { authorization: `Bearer ${token}` }),
    "content-type": "application/json",
    "x-forwarded-for": `13.${Number.parseInt(bytes.slice(0, 2), 16)}.${Number.parseInt(bytes.slice(2, 4), 16)}.${Number.parseInt(bytes.slice(4, 6), 16)}`,
  });
}

function sendCode({ email, requestHeaders }: { email: string; requestHeaders: Headers }) {
  return sendEmailCode(
    new NextRequest(`${BASE_URL}/v1/email-sign-in-codes`, {
      body: JSON.stringify({ email }),
      headers: requestHeaders,
      method: "POST",
    }),
  );
}

function deleteAccount({ body, requestHeaders }: { body: unknown; requestHeaders: Headers }) {
  vi.mocked(headers).mockResolvedValue(requestHeaders as Awaited<ReturnType<typeof headers>>);

  return deleteCurrentAccount(
    new NextRequest(`${BASE_URL}/v1/me`, {
      body: JSON.stringify(body),
      headers: requestHeaders,
      method: "DELETE",
    }),
  );
}

describe("native account deletion through the production email-code API", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "test-private-store-token");

    vi.mocked(checkBotId).mockResolvedValue({
      bypassed: false,
      isBot: true,
      isHuman: false,
      isVerifiedBot: false,
    });

    vi.mocked(list).mockResolvedValue({ blobs: [], hasMore: false } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deletes an email-only learner using their stale bearer and an emailed code", async () => {
    const user = await emailOnlyLearner();
    const requestHeaders = nativeHeaders(user.token);
    const staleDeletion = await deleteAccount({ body: {}, requestHeaders });
    expect(staleDeletion.status).toBe(403);

    const sent = await sendCode({ email: user.email, requestHeaders });
    expect(sent.status).toBe(204);
    const otp = vi.mocked(sendVerificationOTP).mock.calls[0]?.[0].otp;
    expect(otp).toBeTypeOf("string");
    const wrongCode = otp === "000000" ? "111111" : "000000";

    const refused = await deleteAccount({
      body: { emailCredentials: { email: user.email, otp: wrongCode } },
      requestHeaders,
    });

    expect(refused.status).toBe(400);

    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "ACCOUNT_DELETION_INVALID_OTP" },
    });

    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.not.toBeNull();
    await expect(prisma.session.count({ where: { userId: user.id } })).resolves.toBe(1);

    const deleted = await deleteAccount({
      body: { emailCredentials: { email: user.email, otp } },
      requestHeaders,
    });

    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toStrictEqual({ appleAuthorizationRevoked: null });
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
    await expect(prisma.session.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      prisma.verification.count({ where: { identifier: `sign-in-otp-${user.email}` } }),
    ).resolves.toBe(0);
  });

  it.each(["missing", "another account"])(
    "refuses code delivery with a %s bearer",
    async (kind) => {
      const [user, other] = await Promise.all([emailOnlyLearner(), emailOnlyLearner()]);

      const response = await sendCode({
        email: user.email,
        requestHeaders: nativeHeaders(kind === "missing" ? undefined : other.token),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "BOT_DETECTED" } });
      expect(sendVerificationOTP).not.toHaveBeenCalled();
    },
  );

  it("retains the shared rate-limit error and Retry-After for authenticated delivery", async () => {
    const user = await emailOnlyLearner();
    const requestHeaders = nativeHeaders(user.token);

    const input = { email: user.email, requestHeaders };
    const sent = [await sendCode(input), await sendCode(input), await sendCode(input)];
    expect(sent.map((response) => response.status)).toStrictEqual([204, 204, 204]);

    const response = await sendCode(input);
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMIT_EXCEEDED" },
    });

    expect(sendVerificationOTP).toHaveBeenCalledTimes(3);
  });

  it("refuses another account's valid code and removes its temporary reauthentication session", async () => {
    const [user, other] = await Promise.all([emailOnlyLearner(), emailOnlyLearner()]);

    const sent = await sendCode({ email: other.email, requestHeaders: nativeHeaders(other.token) });
    expect(sent.status).toBe(204);

    const otp = vi.mocked(sendVerificationOTP).mock.calls[0]?.[0].otp;

    const response = await deleteAccount({
      body: { emailCredentials: { email: other.email, otp } },
      requestHeaders: nativeHeaders(user.token),
    });

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ACCOUNT_DELETION_EMAIL_MISMATCH" },
    });

    await expect(prisma.user.count({ where: { id: { in: [user.id, other.id] } } })).resolves.toBe(
      2,
    );

    await expect(prisma.session.count({ where: { userId: other.id } })).resolves.toBe(1);
  });
});
