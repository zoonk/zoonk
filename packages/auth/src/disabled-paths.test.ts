import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { createEmailVerificationToken } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it } from "vitest";
import { BETTER_AUTH_BASE_PATH } from "./config";
import { baseAuthConfig, baseAuthPlugins, fullPlugins } from "./server";

const ORIGIN = "http://localhost:3000";
const SESSION_COOKIE = "better-auth.session_token";
const PASSWORD = "disabled-paths-password";
const SECRET = "disabled-paths-test-secret-with-enough-entropy";

/** Production's auth rules and plugins, with email and password to sign learners in. */
const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: ORIGIN,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: { enabled: false },
  secret: SECRET,
  socialProviders: {
    // Google, answered here: a refresh hands out a new access token.
    google: {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      getUserInfo: async () => null,
      refreshAccessToken: async () => ({
        accessToken: "refreshed-access-token",
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    },
  },
});

function read({ cookie, path }: { cookie: string; path: string }) {
  return auth.handler(
    new Request(`${ORIGIN}${BETTER_AUTH_BASE_PATH}${path}`, {
      headers: { cookie, origin: ORIGIN },
    }),
  );
}

/** A learner whose session was last written an hour ago, with only its session cookie to send. */
async function signUp() {
  const response = await auth.handler(
    new Request(`${ORIGIN}${BETTER_AUTH_BASE_PATH}/sign-up/email`, {
      body: JSON.stringify({
        email: `disabled-paths-${randomUUID()}@example.test`,
        name: "Learner",
        password: PASSWORD,
      }),
      headers: { "content-type": "application/json", origin: ORIGIN },
      method: "POST",
    }),
  );

  const { user } = await response.json();

  await prisma.session.updateMany({
    data: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) },
    where: { userId: user.id },
  });

  const session = response.headers
    .getSetCookie()
    .find((header) => header.startsWith(`${SESSION_COOKIE}=`))
    ?.split(";")[0];

  return { cookie: String(session), userId: String(user.id) };
}

describe("GETs that would write, switched off", () => {
  it.each(["/organization/get-organization", "/organization/get-full-organization"])(
    "%s is off, so asking for someone else's organization leaves the session as it was",
    async (path) => {
      const { cookie, userId } = await signUp();
      const before = await prisma.session.findFirstOrThrow({ where: { userId } });

      const organization = await prisma.organization.create({
        data: {
          createdAt: new Date(),
          id: randomUUID(),
          kind: "brand",
          name: "Someone Else's Organization",
          slug: `disabled-paths-${randomUUID()}`,
        },
      });

      const response = await read({ cookie, path: `${path}?organizationId=${organization.id}` });

      await expect(prisma.session.findFirstOrThrow({ where: { userId } })).resolves.toStrictEqual(
        before,
      );

      expect(response.status).toBe(404);
    },
  );

  it("/account-info is off, so reading a learner's Google account never refreshes its tokens", async () => {
    const { cookie, userId } = await signUp();

    const account = await prisma.account.create({
      data: {
        accessToken: "expired-access-token",
        accessTokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
        accountId: randomUUID(),
        providerId: "google",
        refreshToken: "google-refresh-token",
        userId,
      },
    });

    const response = await read({ cookie, path: `/account-info?accountId=${account.id}` });

    await expect(
      prisma.account.findUniqueOrThrow({ where: { id: account.id } }),
    ).resolves.toStrictEqual(account);

    expect(response.status).toBe(404);
  });

  it("/one-time-token/generate is off, so a GET never mints a sign-in token", async () => {
    const { cookie, userId } = await signUp();
    const { token } = await prisma.session.findFirstOrThrow({ where: { userId } });

    const response = await read({ cookie, path: "/one-time-token/generate" });

    await expect(prisma.verification.count({ where: { value: token } })).resolves.toBe(0);
    expect(response.status).toBe(404);
  });

  it("/verify-email is off, so a GET never marks a learner's email verified", async () => {
    const { cookie, userId } = await signUp();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const token = await createEmailVerificationToken(SECRET, before.email);

    const response = await read({ cookie, path: `/verify-email?token=${token}` });

    await expect(prisma.user.findUniqueOrThrow({ where: { id: userId } })).resolves.toStrictEqual(
      before,
    );

    expect(response.status).toBe(404);
  });

  it("/delete-user/callback is off, so a GET never spends an account deletion token", async () => {
    const { cookie } = await signUp();
    const token = randomUUID();

    // Someone else's token: the callback would spend it, then refuse.
    const verification = await prisma.verification.create({
      data: {
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        identifier: `delete-account-${token}`,
        value: randomUUID(),
      },
    });

    const response = await read({ cookie, path: `/delete-user/callback?token=${token}` });

    await expect(
      prisma.verification.findUnique({ where: { id: verification.id } }),
    ).resolves.toStrictEqual(verification);

    expect(response.status).toBe(404);
  });
});
