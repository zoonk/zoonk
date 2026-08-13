import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reauthorizeAppleForAccountDeletion, signInWithNativeApple } from "./native-apple";

const mocks = vi.hoisted(() => ({
  exchangeAuthorizationCode: vi.fn(),
  revokeToken: vi.fn(),
  signInExistingAppleAccount: vi.fn(),
  signInNativeAppleAccount: vi.fn(),
  verifyIdentityToken: vi.fn(),
}));

vi.mock("./native-apple-session", () => ({
  signInWithExistingAppleAccount: mocks.signInExistingAppleAccount,
  signInWithNativeAppleAccount: mocks.signInNativeAppleAccount,
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

/**
 * Uses persisted UUIDs in mocked provider responses so rollback tests exercise
 * real Prisma relationships instead of inventing a parallel database model.
 */
function createTestUser() {
  const id = randomUUID();

  return prisma.user.create({
    data: { email: `native-apple-${id}@example.test`, id, name: "Native Apple Test User" },
  });
}

/**
 * Represents the Apple link that Better Auth would have persisted before the
 * native orchestration verifies ownership and stores provider credentials.
 */
function createAppleAccount({ subject, userId }: { subject: string; userId: string }) {
  return prisma.account.create({ data: { accountId: subject, providerId: "apple", userId } });
}

/**
 * Persists the session returned by the mocked Better Auth boundary so every
 * cleanup assertion observes the production cascade and unique-token behavior.
 */
async function createSessionResponse({ userId }: { userId: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const token = `native-apple-${randomUUID()}`;

  await prisma.session.create({
    data: { expiresAt: new Date(Date.now() + 60_000), token, userId },
  });

  return {
    redirect: false,
    token,
    url: undefined,
    user: { email: user.email, id: user.id, name: user.name },
  };
}

/**
 * Gives both Apple identity-token checks one request-unique subject so durable
 * accounts left by other integration tests cannot affect exact-owner lookup.
 */
function verifySubject(subject: string) {
  mocks.verifyIdentityToken.mockResolvedValue({ subject });
}

describe(signInWithNativeApple, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeAuthorizationCode.mockResolvedValue(authorization);

    // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest's promise shorthand requires an explicit resolved value.
    mocks.revokeToken.mockResolvedValue(undefined);
  });

  it("persists Apple's exchanged tokens on the exact verified account", async () => {
    const subject = `apple-${randomUUID()}`;
    const user = await createTestUser();

    const [account, sessionResponse] = await Promise.all([
      createAppleAccount({ subject, userId: user.id }),
      createSessionResponse({ userId: user.id }),
    ]);

    verifySubject(subject);

    mocks.signInNativeAppleAccount.mockResolvedValue({
      changes: { sessionToken: sessionResponse.token },
      response: sessionResponse,
      success: true,
    });

    await expect(signInWithNativeApple(credentials)).resolves.toStrictEqual(sessionResponse);

    const persistedAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(persistedAccount.accessToken).toBe(authorization.accessToken);
    expect(persistedAccount.idToken).toBe(authorization.idToken);
    expect(persistedAccount.refreshToken).toBe(authorization.refreshToken);
    expect(persistedAccount.accessTokenExpiresAt).toBeInstanceOf(Date);
    expect(mocks.revokeToken).not.toHaveBeenCalled();
    expect(mocks.signInNativeAppleAccount).toHaveBeenCalledExactlyOnceWith(credentials);
  });

  it("rejects an Apple account that belongs to another Zoonk user", async () => {
    const subject = `apple-${randomUUID()}`;
    const [sessionUser, accountOwner] = await Promise.all([createTestUser(), createTestUser()]);

    const [account, sessionResponse] = await Promise.all([
      createAppleAccount({ subject, userId: accountOwner.id }),
      createSessionResponse({ userId: sessionUser.id }),
    ]);

    verifySubject(subject);

    mocks.signInNativeAppleAccount.mockResolvedValue({
      changes: { sessionToken: sessionResponse.token },
      response: sessionResponse,
      success: true,
    });

    await expect(signInWithNativeApple(credentials)).rejects.toThrow(
      "Apple account does not belong to the authenticated user",
    );

    await expect(
      prisma.session.findUnique({ where: { token: sessionResponse.token } }),
    ).resolves.toBeNull();

    await expect(prisma.account.findUnique({ where: { id: account.id } })).resolves.not.toBeNull();

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });
  });

  it("revokes Apple's token and rolls back new auth rows when persistence fails", async () => {
    const subject = `apple-${randomUUID()}`;
    const user = await createTestUser();

    const [account, sessionResponse] = await Promise.all([
      createAppleAccount({ subject, userId: user.id }),
      createSessionResponse({ userId: user.id }),
    ]);

    verifySubject(subject);
    mocks.exchangeAuthorizationCode.mockResolvedValue({ ...authorization, expiresIn: Number.NaN });

    mocks.signInNativeAppleAccount.mockResolvedValue({
      changes: { accountId: account.id, sessionToken: sessionResponse.token, userId: user.id },
      response: sessionResponse,
      success: true,
    });

    await expect(signInWithNativeApple(credentials)).rejects.toThrow();

    const [persistedUser, persistedAccount, persistedSession] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.account.findUnique({ where: { id: account.id } }),
      prisma.session.findUnique({ where: { token: sessionResponse.token } }),
    ]);

    expect(persistedUser).toBeNull();
    expect(persistedAccount).toBeNull();
    expect(persistedSession).toBeNull();

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });
  });
});

describe(reauthorizeAppleForAccountDeletion, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeAuthorizationCode.mockResolvedValue(authorization);

    // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest's promise shorthand requires an explicit resolved value.
    mocks.revokeToken.mockResolvedValue(undefined);
  });

  it("returns a fresh Zoonk session only after revoking the reauthorized Apple grant", async () => {
    const subject = `apple-${randomUUID()}`;
    const user = await createTestUser();
    const sessionResponse = await createSessionResponse({ userId: user.id });
    await createAppleAccount({ subject, userId: user.id });

    verifySubject(subject);

    mocks.signInExistingAppleAccount.mockResolvedValue({
      changes: { sessionToken: sessionResponse.token },
      response: sessionResponse,
      success: true,
    });

    await expect(
      reauthorizeAppleForAccountDeletion({ credentials, expectedUserId: user.id }),
    ).resolves.toStrictEqual({
      appleAuthorizationRevoked: true,
      sessionToken: sessionResponse.token,
    });

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });

    expect(mocks.signInExistingAppleAccount).toHaveBeenCalledExactlyOnceWith(credentials);
    expect(mocks.signInNativeAppleAccount).not.toHaveBeenCalled();
  });

  it("rejects an unregistered Apple identity before a signup-capable social sign-in", async () => {
    const subject = `apple-${randomUUID()}`;
    const user = await createTestUser();
    verifySubject(subject);

    await expect(
      reauthorizeAppleForAccountDeletion({ credentials, expectedUserId: user.id }),
    ).rejects.toThrow("Apple reauthorization does not match the current user");

    expect(mocks.signInExistingAppleAccount).not.toHaveBeenCalled();
    expect(mocks.signInNativeAppleAccount).not.toHaveBeenCalled();

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });
  });

  it("keeps the fresh Zoonk session available when Apple revocation is unavailable", async () => {
    const subject = `apple-${randomUUID()}`;
    const user = await createTestUser();
    const sessionResponse = await createSessionResponse({ userId: user.id });
    await createAppleAccount({ subject, userId: user.id });

    verifySubject(subject);
    mocks.revokeToken.mockRejectedValue(new Error("Apple unavailable"));

    mocks.signInExistingAppleAccount.mockResolvedValue({
      changes: { sessionToken: sessionResponse.token },
      response: sessionResponse,
      success: true,
    });

    await expect(
      reauthorizeAppleForAccountDeletion({ credentials, expectedUserId: user.id }),
    ).resolves.toStrictEqual({
      appleAuthorizationRevoked: false,
      sessionToken: sessionResponse.token,
    });

    await expect(
      prisma.session.findUnique({ where: { token: sessionResponse.token } }),
    ).resolves.not.toBeNull();
  });

  it("does not authorize deletion when the fresh Apple identity belongs to another user", async () => {
    const subject = `apple-${randomUUID()}`;
    const [expectedUser, sessionUser] = await Promise.all([createTestUser(), createTestUser()]);
    const account = await createAppleAccount({ subject, userId: expectedUser.id });
    const sessionResponse = await createSessionResponse({ userId: sessionUser.id });

    verifySubject(subject);

    mocks.signInExistingAppleAccount.mockImplementationOnce(async () => {
      await prisma.account.update({ data: { userId: sessionUser.id }, where: { id: account.id } });

      return {
        changes: { sessionToken: sessionResponse.token },
        response: sessionResponse,
        success: true,
      };
    });

    await expect(
      reauthorizeAppleForAccountDeletion({ credentials, expectedUserId: expectedUser.id }),
    ).rejects.toThrow("Apple reauthorization does not match the current user");

    await expect(
      prisma.session.findUnique({ where: { token: sessionResponse.token } }),
    ).resolves.toBeNull();

    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      clientIdentifier: "com.zoonk.dev",
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });
  });
});
