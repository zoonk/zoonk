import { beforeEach, describe, expect, it, vi } from "vitest";
import { revokeStoredAppleAuthorization } from "./apple-revocation";

const mocks = vi.hoisted(() => ({ revokeToken: vi.fn() }));

vi.mock("./apple", () => ({
  getAppleConfiguration: () => ({
    appBundleIdentifier: "com.zoonk.Zoonk",
    clientId: "com.zoonk.web",
  }),
}));

vi.mock("./apple-rest", () => ({ revokeAppleToken: mocks.revokeToken }));

function storedAppleIdToken(audience: string) {
  const payload = Buffer.from(JSON.stringify({ aud: audience })).toString("base64url");
  return `e30.${payload}.signature`;
}

describe(revokeStoredAppleAuthorization, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest's promise shorthand requires an explicit resolved value.
    mocks.revokeToken.mockResolvedValue(undefined);
  });

  it("revokes a stored native grant with its bundle identifier", async () => {
    await expect(
      revokeStoredAppleAuthorization({
        idToken: storedAppleIdToken("com.zoonk.Zoonk"),
        refreshToken: "stored-refresh-token",
      }),
    ).resolves.toBe(true);

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.Zoonk",
      token: "stored-refresh-token",
      tokenType: "refresh_token",
    });
  });

  it("keeps account deletion available when stored Apple revocation fails", async () => {
    mocks.revokeToken.mockRejectedValue(new Error("Apple unavailable"));

    await expect(
      revokeStoredAppleAuthorization({
        idToken: storedAppleIdToken("com.zoonk.web"),
        refreshToken: "stored-refresh-token",
      }),
    ).resolves.toBe(false);
  });
});
