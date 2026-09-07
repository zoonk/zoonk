import { type apple, type getApplePublicKey } from "better-auth/social-providers";
import { SignJWT, exportPKCS8, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getApplePublicKey: vi.fn() }));

/** Apple's remote key lookup is the only external boundary; token verification stays real. */
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

  it("verifies a signed native token using the built-in provider's issuer", async () => {
    const { verifyNativeAppleIdentityToken } = await import("./apple-token");
    const token = await createIdentityToken();

    await expect(
      verifyNativeAppleIdentityToken({ nonce: "native-nonce", token }),
    ).resolves.toStrictEqual({
      issuer: "https://appleid.apple.com",
      subject: "apple-token-test-subject",
    });
  });

  it.each([
    { issuer: "https://another-provider.example" },
    { audience: "com.zoonk.web" },
    { nonce: "another-nonce" },
  ])("rejects a token with mismatched claims: %j", async (claims) => {
    const { verifyNativeAppleIdentityToken } = await import("./apple-token");
    const token = await createIdentityToken(claims);

    await expect(
      verifyNativeAppleIdentityToken({ nonce: "native-nonce", token }),
    ).rejects.toMatchObject({ reason: "invalidCredential" });
  });
});
