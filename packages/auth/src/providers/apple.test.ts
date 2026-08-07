import { type AppleProfile } from "better-auth/social-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importPrivateKey: vi.fn<() => Promise<unknown>>(),
  signClientSecret: vi.fn<() => Promise<string>>(),
}));

vi.mock("jose", () => ({
  SignJWT: class {
    setAudience() {
      return this;
    }

    setExpirationTime() {
      return this;
    }

    setIssuedAt() {
      return this;
    }

    setIssuer() {
      return this;
    }

    setProtectedHeader() {
      return this;
    }

    setSubject() {
      return this;
    }

    async sign() {
      void this;

      return mocks.signClientSecret();
    }
  },
  importPKCS8: mocks.importPrivateKey,
}));

describe("Apple provider profile mapping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", "com.zoonk.Zoonk");
    vi.stubEnv("APPLE_CLIENT_ID", "com.zoonk.web");
    vi.stubEnv("APPLE_KEY_ID", "apple-key-id");
    vi.stubEnv("APPLE_PRIVATE_KEY", "apple-private-key");
    vi.stubEnv("APPLE_TEAM_ID", "apple-team-id");
    mocks.importPrivateKey.mockResolvedValue("private-key");
    mocks.signClientSecret.mockResolvedValue("client-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Apple's stable subject when a repeat sign-in omits the email claim", async () => {
    const { appleProvider } = await import("./apple");
    const provider = appleProvider.apple;

    expect(provider).toBeDefined();

    const profile = { sub: "stable-apple-subject" } as AppleProfile;
    const mappedUser = provider?.mapProfileToUser(profile);

    expect(mappedUser).toStrictEqual({ email: "stable-apple-subject@apple.placeholder.local" });
  });

  it("keeps the public social endpoint scoped to the web Services ID", async () => {
    const { appleProvider } = await import("./apple");

    expect(appleProvider.apple).toMatchObject({ clientId: "com.zoonk.web" });
    expect(appleProvider.apple).not.toHaveProperty("appBundleIdentifier");
    expect(appleProvider.apple).not.toHaveProperty("audience");
  });

  it("scopes the internal native provider to the app bundle identifier", async () => {
    const { getNativeAppleProvider } = await import("./apple");

    expect(getNativeAppleProvider().apple).toMatchObject({
      appBundleIdentifier: "com.zoonk.Zoonk",
      clientId: "com.zoonk.web",
    });

    expect(getNativeAppleProvider().apple).not.toHaveProperty("audience");
  });

  it("keeps existing web Apple sign-in enabled before native configuration is deployed", async () => {
    vi.stubEnv("APPLE_APP_BUNDLE_IDENTIFIER", "");
    vi.resetModules();

    const { appleProvider, getAppleConfiguration } = await import("./apple");

    expect(appleProvider.apple).toMatchObject({ clientId: "com.zoonk.web" });
    expect(getAppleConfiguration()).toBeNull();
  });
});
