import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type GenericEndpointContext } from "better-auth";
import { betterAuth } from "better-auth/minimal";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { toCookieHeaders } from "./guests/_test-utils/guest-auth";
import { nameProviderAccount } from "./provider-username";
import { baseAuthConfig, baseAuthPlugins } from "./server";

const BASE_URL = "http://localhost:3000";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const providerAuth = betterAuth({
  ...baseAuthConfig,
  baseURL: BASE_URL,
  plugins: [...baseAuthPlugins],
  rateLimit: { enabled: false },
  secret: "provider-username-test-secret-with-enough-entropy",
  socialProviders: {
    google: {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    },
  },
});

function encodeJwtPart(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** Google's sign-in reads the profile from the ID token without checking its signature. */
function googleIdToken(email: string) {
  const profile = { email, email_verified: true, name: "Maria Silva", sub: email };

  return `${encodeJwtPart({ alg: "none" })}.${encodeJwtPart(profile)}.`;
}

async function signUpWithGoogleInBrowser(email: string) {
  const { headers, response } = await providerAuth.api.signInSocial({
    body: { callbackURL: "/", provider: "google" },
    returnHeaders: true,
  });

  const state = new URL(response.url ?? "").searchParams.get("state") ?? "";
  const callback = new URL(`${BASE_URL}/api/auth/callback/google`);
  callback.search = new URLSearchParams({ code: email, state }).toString();

  const result = await providerAuth.handler(
    new Request(callback, { headers: toCookieHeaders(headers) }),
  );

  return { headers: toCookieHeaders(result.headers), location: result.headers.get("location") };
}

function newUser({ email, name }: { email: string; name: string }) {
  const now = new Date();
  return { createdAt: now, email, emailVerified: true, id: randomUUID(), name, updatedAt: now };
}

function endpoint(path: string) {
  return { path } as GenericEndpointContext;
}

function uniquePrefix() {
  return `named${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

describe(nameProviderAccount, () => {
  it("names an account Google or Apple created in the browser after its email", async () => {
    const prefix = uniquePrefix();
    const user = newUser({ email: `${prefix}@example.test`, name: "Ana Souza" });

    await expect(nameProviderAccount(user, endpoint("/callback/:id"))).resolves.toStrictEqual({
      data: { ...user, username: prefix },
    });
  });

  it("adds a few numbers when another account has the email's name", async () => {
    const prefix = uniquePrefix();

    await prisma.user.create({
      data: { email: `${prefix}@other.test`, name: "", username: prefix },
    });

    const user = newUser({ email: `${prefix}@example.test`, name: "Ana Souza" });

    const result = await nameProviderAccount(user, endpoint("/callback/:id"));

    expect(result).toMatchObject({ data: { username: expect.stringMatching(`^${prefix}_\\d+$`) } });
  });

  it.each(["/sign-in/social", "/sign-in/email-otp", "/sign-in/anonymous", "/sign-up/email"])(
    "leaves an account created through %s to its own setup",
    async (path) => {
      const user = newUser({ email: `${uniquePrefix()}@example.test`, name: "Ana Souza" });

      await expect(nameProviderAccount(user, endpoint(path))).resolves.toStrictEqual({
        data: user,
      });
    },
  );

  it("leaves an account the provider didn't name to the setup, which asks for both", async () => {
    const user = newUser({ email: `${uniquePrefix()}@example.test`, name: "  " });

    await expect(nameProviderAccount(user, endpoint("/callback/:id"))).resolves.toStrictEqual({
      data: user,
    });

    await expect(nameProviderAccount(user, null)).resolves.toStrictEqual({ data: user });
  });
});

describe("browser Google sign-up", () => {
  const realFetch = globalThis.fetch;

  // Google's token endpoint is outside the test; each sign-up's code is the learner's email.
  beforeAll(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init);

      if (!request.url.startsWith(GOOGLE_TOKEN_ENDPOINT)) {
        return realFetch(input, init);
      }

      const code = new URLSearchParams(await request.text()).get("code");

      return Response.json({
        access_token: "google-access-token",
        expires_in: 3600,
        id_token: googleIdToken(code ?? ""),
        token_type: "Bearer",
      });
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("gives a new learner the email's name that another learner renamed away from", async () => {
    const prefix = uniquePrefix();
    const first = await signUpWithGoogleInBrowser(`${prefix}@example.test`);

    expect(first.location).toBe("/");

    await providerAuth.api.updateUser({
      body: { username: `${prefix}_renamed` },
      headers: first.headers,
    });

    const second = await signUpWithGoogleInBrowser(`${prefix}@other.test`);

    expect(second.location).toBe("/");

    await expect(
      prisma.user.findUniqueOrThrow({
        select: { username: true },
        where: { email: `${prefix}@other.test` },
      }),
    ).resolves.toStrictEqual({ username: prefix });
  });
});
