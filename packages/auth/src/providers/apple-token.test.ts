import { createHash } from "node:crypto";
import { type apple, type getApplePublicKey } from "better-auth/social-providers";
import { SignJWT, exportPKCS8, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getApplePublicKey: vi.fn() }));

vi.mock("better-auth/social-providers", async (importOriginal) => ({
  ...(await importOriginal<{ apple: typeof apple; getApplePublicKey: typeof getApplePublicKey }>()),
  getApplePublicKey: mocks.getApplePublicKey,
}));

const signingKeys = await generateKeyPair("RS256");
const clientSecretKeys = await generateKeyPair("ES256", { extractable: true });

async function createIdentityToken({
  audience = "com.zoonk.dev",
  issuer = "https://appleid.apple.com",
  nonce = "native-nonce",
}: { audience?: string; issuer?: string; nonce?: string } = {}) {
  return new SignJWT({ nonce })
    .setProtectedHeader({ alg: "RS256", kid: "apple-token-test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("apple-token-test-subject")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signingKeys.privateKey);
}

const NATIVE_NONCE = "native-nonce";

/** What Authentication Services and the Android app put in Apple's request: the raw nonce's SHA-256, in hex. */
const HASHED_NONCE = createHash("sha256").update(NATIVE_NONCE).digest("hex");

const CLIENTS = [
  { clientIdentifier: "com.zoonk.dev", otherClientIdentifier: "com.zoonk.web" },
  { clientIdentifier: "com.zoonk.web", otherClientIdentifier: "com.zoonk.dev" },
];

describe("Native Apple identity token verification", () => {
  beforeAll(async () => {
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", "com.zoonk.dev");
    vi.stubEnv("APPLE_CLIENT_ID", "com.zoonk.web");
    vi.stubEnv("APPLE_KEY_ID", "apple-client-secret-key");
    vi.stubEnv("APPLE_PRIVATE_KEY", await exportPKCS8(clientSecretKeys.privateKey));
    vi.stubEnv("APPLE_TEAM_ID", "apple-team-id");
    mocks.getApplePublicKey.mockResolvedValue(signingKeys.publicKey);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it.each(CLIENTS)(
    "verifies a token for $clientIdentifier with the raw nonce whose hash it carries",
    async ({ clientIdentifier }) => {
      const { verifyNativeAppleIdentityToken } = await import("./apple-token");
      const token = await createIdentityToken({ audience: clientIdentifier, nonce: HASHED_NONCE });

      await expect(
        verifyNativeAppleIdentityToken({ clientIdentifier, nonce: NATIVE_NONCE, token }),
      ).resolves.toStrictEqual({
        issuer: "https://appleid.apple.com",
        subject: "apple-token-test-subject",
      });
    },
  );

  it.each(CLIENTS)(
    "rejects a token for $clientIdentifier with the nonce claim sent back as the nonce",
    async ({ clientIdentifier }) => {
      const { verifyNativeAppleIdentityToken } = await import("./apple-token");
      const token = await createIdentityToken({ audience: clientIdentifier, nonce: HASHED_NONCE });

      await expect(
        verifyNativeAppleIdentityToken({ clientIdentifier, nonce: HASHED_NONCE, token }),
      ).rejects.toMatchObject({ reason: "invalidCredential" });
    },
  );

  it.each(CLIENTS)(
    "rejects a token for $otherClientIdentifier when the request names $clientIdentifier",
    async ({ clientIdentifier, otherClientIdentifier }) => {
      const { verifyNativeAppleIdentityToken } = await import("./apple-token");

      const token = await createIdentityToken({
        audience: otherClientIdentifier,
        nonce: HASHED_NONCE,
      });

      await expect(
        verifyNativeAppleIdentityToken({ clientIdentifier, nonce: NATIVE_NONCE, token }),
      ).rejects.toMatchObject({ reason: "invalidCredential" });
    },
  );

  it.each([{ issuer: "https://another-provider.example" }, { nonce: "another-nonce" }])(
    "rejects a token with mismatched claims: %j",
    async (claims) => {
      const { verifyNativeAppleIdentityToken } = await import("./apple-token");
      const token = await createIdentityToken({ nonce: HASHED_NONCE, ...claims });

      await expect(
        verifyNativeAppleIdentityToken({
          clientIdentifier: "com.zoonk.dev",
          nonce: NATIVE_NONCE,
          token,
        }),
      ).rejects.toMatchObject({ reason: "invalidCredential" });
    },
  );
});
