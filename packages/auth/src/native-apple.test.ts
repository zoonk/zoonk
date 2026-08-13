import { beforeEach, describe, expect, it, vi } from "vitest";
import { reauthorizeAppleForAccountDeletion, signInWithNativeApple } from "./native-apple";

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  deleteSession: vi.fn(),
  deleteUser: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  findAccounts: vi.fn(),
  revokeToken: vi.fn(),
  signInExistingAppleAccount: vi.fn(),
  signInNativeAppleAccount: vi.fn(),
  updateAccount: vi.fn(),
  verifyIdentityToken: vi.fn(),
}));

vi.mock("./native-apple-session", () => ({
  signInWithExistingAppleAccount: mocks.signInExistingAppleAccount,
  signInWithNativeAppleAccount: mocks.signInNativeAppleAccount,
}));

vi.mock("@zoonk/db", () => ({
  prisma: {
    account: {
      deleteMany: mocks.deleteAccount,
      findMany: mocks.findAccounts,
      update: mocks.updateAccount,
    },
    session: { deleteMany: mocks.deleteSession },
    user: { deleteMany: mocks.deleteUser },
  },
}));

vi.mock("./providers/apple-rest", () => ({
  exchangeNativeAppleAuthorizationCode: mocks.exchangeAuthorizationCode,
  revokeAppleToken: mocks.revokeToken,
}));

vi.mock("./providers/apple", () => ({
  getAppleConfiguration: () => ({
    appBundleIdentifier: "com.zoonk.dev",
    clientId: "com.zoonk.web",
  }),
}));

vi.mock("./providers/apple-token", () => ({
  verifyNativeAppleIdentityToken: mocks.verifyIdentityToken,
}));

const credentials = {
  authorizationCode: "single-use-code",
  idToken: "native-identity-token",
  nonce: "raw-nonce",
  user: { email: "learner@example.com", name: { firstName: "Ada", lastName: "Lovelace" } },
};

const authorization = {
  accessToken: "apple-access-token",
  expiresIn: 3600,
  idToken: "exchanged-identity-token",
  refreshToken: "apple-refresh-token",
};

const sessionResponse = {
  redirect: false,
  token: "zoonk-session-token",
  url: undefined,
  user: { email: "learner@example.com", id: "user-id", name: "Ada Lovelace" },
};

describe(signInWithNativeApple, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeAuthorizationCode.mockResolvedValue(authorization);

    mocks.findAccounts.mockResolvedValue([
      { accountId: "apple-subject", id: "account-id", providerId: "apple", userId: "user-id" },
    ]);

    // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest's promise shorthand requires an explicit resolved value.
    mocks.revokeToken.mockResolvedValue(undefined);

    mocks.signInNativeAppleAccount.mockResolvedValue({
      changes: { sessionToken: sessionResponse.token },
      response: sessionResponse,
      success: true,
    });

    mocks.updateAccount.mockResolvedValue({ id: "account-id" });
    mocks.verifyIdentityToken.mockResolvedValue({ subject: "apple-subject" });
  });

  it("persists Apple's exchanged tokens on the exact verified account", async () => {
    await expect(signInWithNativeApple(credentials)).resolves.toStrictEqual(sessionResponse);

    expect(mocks.updateAccount).toHaveBeenCalledExactlyOnceWith({
      data: {
        accessToken: authorization.accessToken,
        accessTokenExpiresAt: expect.any(Date),
        idToken: authorization.idToken,
        refreshToken: authorization.refreshToken,
      },
      where: { id: "account-id" },
    });

    expect(mocks.revokeToken).not.toHaveBeenCalled();
    expect(mocks.signInNativeAppleAccount).toHaveBeenCalledExactlyOnceWith(credentials);
  });

  it("rejects an Apple account that belongs to another Zoonk user", async () => {
    mocks.findAccounts.mockResolvedValue([
      {
        accountId: "apple-subject",
        id: "account-id",
        providerId: "apple",
        userId: "different-user-id",
      },
    ]);

    await expect(signInWithNativeApple(credentials)).rejects.toThrow(
      "Apple account does not belong to the authenticated user",
    );

    expect(mocks.deleteSession).toHaveBeenCalledExactlyOnceWith({
      where: { token: { in: [sessionResponse.token] } },
    });

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });
  });

  it("revokes Apple's token and removes the new session when persistence fails", async () => {
    mocks.signInNativeAppleAccount.mockResolvedValue({
      changes: {
        accountId: "account-id",
        sessionToken: sessionResponse.token,
        userId: sessionResponse.user.id,
      },
      response: sessionResponse,
      success: true,
    });

    mocks.updateAccount.mockRejectedValue(new Error("database unavailable"));

    await expect(signInWithNativeApple(credentials)).rejects.toThrow("database unavailable");

    expect(mocks.deleteSession).toHaveBeenCalledExactlyOnceWith({
      where: { token: { in: [sessionResponse.token] } },
    });

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });

    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith({
      where: { id: sessionResponse.user.id },
    });

    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });
});

describe(reauthorizeAppleForAccountDeletion, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeAuthorizationCode.mockResolvedValue(authorization);

    mocks.findAccounts.mockResolvedValue([
      { accountId: "apple-subject", id: "account-id", providerId: "apple", userId: "user-id" },
    ]);

    // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest's promise shorthand requires an explicit resolved value.
    mocks.revokeToken.mockResolvedValue(undefined);

    mocks.signInExistingAppleAccount.mockResolvedValue({
      changes: { sessionToken: sessionResponse.token },
      response: sessionResponse,
      success: true,
    });

    mocks.verifyIdentityToken.mockResolvedValue({ subject: "apple-subject" });
  });

  it("returns a fresh Zoonk session only after revoking the reauthorized Apple grant", async () => {
    await expect(
      reauthorizeAppleForAccountDeletion({ credentials, expectedUserId: "user-id" }),
    ).resolves.toStrictEqual({
      appleAuthorizationRevoked: true,
      sessionToken: sessionResponse.token,
    });

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });

    expect(mocks.updateAccount).not.toHaveBeenCalled();
    expect(mocks.signInExistingAppleAccount).toHaveBeenCalledExactlyOnceWith(credentials);
    expect(mocks.signInNativeAppleAccount).not.toHaveBeenCalled();
  });

  it("rejects an unregistered Apple identity before a signup-capable social sign-in", async () => {
    mocks.findAccounts.mockResolvedValue([]);

    await expect(
      reauthorizeAppleForAccountDeletion({ credentials, expectedUserId: "user-id" }),
    ).rejects.toThrow("Apple reauthorization does not match the current user");

    expect(mocks.signInExistingAppleAccount).not.toHaveBeenCalled();
    expect(mocks.signInNativeAppleAccount).not.toHaveBeenCalled();
    expect(mocks.deleteSession).not.toHaveBeenCalled();

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });
  });

  it("keeps the fresh Zoonk session available when Apple revocation is unavailable", async () => {
    mocks.revokeToken.mockRejectedValue(new Error("Apple unavailable"));

    await expect(
      reauthorizeAppleForAccountDeletion({ credentials, expectedUserId: "user-id" }),
    ).resolves.toStrictEqual({
      appleAuthorizationRevoked: false,
      sessionToken: sessionResponse.token,
    });

    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });

  it("does not authorize deletion when the fresh Apple identity belongs to another user", async () => {
    mocks.findAccounts
      .mockResolvedValueOnce([
        {
          accountId: "apple-subject",
          id: "account-id",
          providerId: "apple",
          userId: "different-user-id",
        },
      ])
      .mockResolvedValueOnce([
        { accountId: "apple-subject", id: "account-id", providerId: "apple", userId: "user-id" },
      ]);

    await expect(
      reauthorizeAppleForAccountDeletion({ credentials, expectedUserId: "different-user-id" }),
    ).rejects.toThrow("Apple reauthorization does not match the current user");

    expect(mocks.deleteSession).toHaveBeenCalledExactlyOnceWith({
      where: { token: { in: [sessionResponse.token] } },
    });

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });
  });
});
