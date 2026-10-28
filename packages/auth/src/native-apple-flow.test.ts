import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guestAuth } from "./guests/_test-utils/guest-auth";
import { createGoal } from "./guests/_test-utils/learner-data";
import { signInWithNativeApple } from "./native-apple";
import { baseAuthConfig, baseAuthPlugins, socialProviders } from "./server";

const BUNDLE_IDENTIFIER = "com.zoonk.dev";
const SERVICES_ID = "com.zoonk.web";
const REQUEST_URL = "http://localhost:3000/v1/sessions/apple";

/**
 * Apple's HTTP endpoints are the only boundary replaced: its signing keys, and a token endpoint
 * that answers a code it issued with an identity token for the client the exchange names. Apple's
 * configuration has to exist before the auth modules read it, so this runs before every import.
 */
const apple = await vi.hoisted(async () => {
  const { SignJWT, exportJWK, exportPKCS8, generateKeyPair } = await import("jose");
  const signingKeys = await generateKeyPair("RS256");
  const clientSecretKeys = await generateKeyPair("ES256", { extractable: true });
  const keyId = "apple-flow-test-key";
  const publicKey = { ...(await exportJWK(signingKeys.publicKey)), alg: "RS256", kid: keyId };

  process.env.APPLE_APP_BUNDLE_IDENTIFIER = "com.zoonk.dev";
  process.env.APPLE_CLIENT_ID = "com.zoonk.web";
  process.env.APPLE_KEY_ID = "apple-client-secret-key";
  process.env.APPLE_PRIVATE_KEY = await exportPKCS8(clientSecretKeys.privateKey);
  process.env.APPLE_TEAM_ID = "apple-team-id";
  process.env.NEXT_PUBLIC_API_URL = "https://api.zoonk.com";

  /** `expiresIn` stands in for a grant the server fails to save (an expiry no date can hold). */
  type Identity = { email: string; expiresIn?: number; subject: string };

  const identities = new Map<string, Identity>();
  const tokenRequests: URLSearchParams[] = [];

  function signIdentityToken({
    audience,
    email,
    nonce,
    subject,
  }: Identity & { audience: string; nonce?: string }) {
    return new SignJWT({ email, email_verified: "true", ...(nonce ? { nonce } : {}) })
      .setProtectedHeader({ alg: "RS256", kid: keyId })
      .setIssuer("https://appleid.apple.com")
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(signingKeys.privateKey);
  }

  async function answerTokenRequest(body: URLSearchParams) {
    tokenRequests.push(body);
    const identity = identities.get(body.get("code") ?? "");

    if (!identity) {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }

    return Response.json({
      access_token: `apple-access-${identity.subject}`,
      expires_in: identity.expiresIn ?? 3600,
      id_token: await signIdentityToken({ ...identity, audience: body.get("client_id") ?? "" }),
      refresh_token: `apple-refresh-${identity.subject}`,
      token_type: "Bearer",
    });
  }

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();

    if (url === "https://appleid.apple.com/auth/keys") {
      return Response.json({ keys: [publicKey] });
    }

    if (url === "https://appleid.apple.com/auth/token") {
      return answerTokenRequest(new URLSearchParams(init?.body as string));
    }

    throw new Error(`Unexpected request to ${url}`);
  });

  return { identities, signIdentityToken, tokenRequests };
});

/** What Apple hands the app after the learner authorizes: a single-use code and an identity token. */
async function authorizeWithApple({
  audience,
  expiresIn,
}: {
  audience: string;
  expiresIn?: number;
}) {
  const id = randomUUID();

  const identity = {
    email: `apple-flow-${id}@example.test`,
    expiresIn,
    subject: `apple-flow-${id}`,
  };

  const authorizationCode = `apple-code-${id}`;
  const rawNonce = `raw-nonce-${id}`;
  const hashedNonce = createHash("sha256").update(rawNonce).digest("hex");

  apple.identities.set(authorizationCode, identity);

  return {
    authorizationCode,
    idToken: await apple.signIdentityToken({ ...identity, audience, nonce: hashedNonce }),
    nonce: rawNonce,
  };
}

/** One address per test keeps Better Auth's sign-in rate limit from counting other tests' attempts. */
function createRequestIP() {
  const bytes = randomUUID().replaceAll("-", "").slice(0, 6);
  return `12.${Number.parseInt(bytes.slice(0, 2), 16)}.${Number.parseInt(bytes.slice(2, 4), 16)}.${Number.parseInt(bytes.slice(4, 6), 16)}`;
}

describe("native Apple sign-in through Apple's endpoints", () => {
  const requestIPs = new Set<string>();

  afterEach(async () => {
    await prisma.rateLimit.deleteMany({
      where: { key: { in: [...requestIPs].map((ip) => `${ip}|/sign-in/native-apple`) } },
    });

    requestIPs.clear();
  });

  it.each([
    { client: "app", clientIdentifier: BUNDLE_IDENTIFIER, redirectURI: null },
    {
      client: "web",
      clientIdentifier: SERVICES_ID,
      redirectURI: "https://api.zoonk.com/auth/apple/android",
    },
  ] as const)(
    "moves a guest's progress to the Apple account the guest signs in with ($client)",
    async ({ client, clientIdentifier, redirectURI }) => {
      const guest = await guestAuth.api.signInAnonymous();
      const goal = await createGoal(guest.user.id);
      const credentials = await authorizeWithApple({ audience: clientIdentifier });
      const ip = createRequestIP();
      requestIPs.add(ip);

      const session = await signInWithNativeApple({
        credentials: { ...credentials, client },
        headers: new Headers({ authorization: `Bearer ${guest.token}`, "x-forwarded-for": ip }),
        requestURL: REQUEST_URL,
      });

      const [movedGoal, account] = await Promise.all([
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
        prisma.account.findFirstOrThrow({
          where: { providerId: "apple", userId: session.user.id },
        }),
      ]);

      expect(session.user.id).not.toBe(guest.user.id);
      expect(movedGoal.userId).toBe(session.user.id);
      expect(account.refreshToken).toBe(`apple-refresh-${account.accountId}`);

      const exchange = apple.tokenRequests.find(
        (body) => body.get("code") === credentials.authorizationCode,
      );

      expect(exchange?.get("client_id")).toBe(clientIdentifier);
      expect(exchange?.get("redirect_uri") ?? null).toBe(redirectURI);
    },
  );
});

describe("a guest's Apple sign-in that fails after Apple's grant", () => {
  it("leaves the guest and its progress as they were, so it can try again", async () => {
    const guest = await guestAuth.api.signInAnonymous();
    const goal = await createGoal(guest.user.id);
    const ip = createRequestIP();

    const credentials = await authorizeWithApple({
      audience: SERVICES_ID,
      expiresIn: Number.MAX_VALUE,
    });

    await expect(
      signInWithNativeApple({
        credentials: { ...credentials, client: "web" },
        headers: new Headers({ authorization: `Bearer ${guest.token}`, "x-forwarded-for": ip }),
        requestURL: REQUEST_URL,
      }),
    ).rejects.toThrow();

    await prisma.rateLimit.deleteMany({ where: { key: `${ip}|/sign-in/native-apple` } });

    const [keptGoal, guestSession] = await Promise.all([
      prisma.goal.findUnique({ where: { id: goal.id } }),
      prisma.session.findUnique({ where: { token: guest.token } }),
    ]);

    expect(keptGoal?.userId).toBe(guest.user.id);
    expect(guestSession?.userId).toBe(guest.user.id);
  });
});

describe("Better Auth's public social endpoint", () => {
  it("refuses an Apple identity token, which signs in only through the native path", async () => {
    const publicAuth = betterAuth({
      ...baseAuthConfig,
      plugins: [...baseAuthPlugins],
      rateLimit: { enabled: false },
      socialProviders,
    });

    const { idToken } = await authorizeWithApple({ audience: SERVICES_ID });

    await expect(
      publicAuth.api.signInSocial({ body: { idToken: { token: idToken }, provider: "apple" } }),
    ).rejects.toMatchObject({ body: { code: "ID_TOKEN_NOT_SUPPORTED" } });
  });
});
