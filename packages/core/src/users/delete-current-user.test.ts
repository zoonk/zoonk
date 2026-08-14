import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCurrentUser } from "./delete-current-user";

const mocks = vi.hoisted(() => ({
  captureDeletionCleanup: vi.fn(),
  deleteUser: vi.fn(),
  getRequestHeaders: vi.fn(),
  getSession: vi.fn(),
  reauthorizeApple: vi.fn(),
  reauthorizeEmail: vi.fn(),
}));

vi.mock("@zoonk/auth", () => ({
  auth: { api: { deleteUser: mocks.deleteUser } },
  reauthorizeEmailForAccountDeletion: mocks.reauthorizeEmail,
}));

vi.mock("@zoonk/auth/account-deletion", () => ({
  captureAccountDeletionCleanup: mocks.captureDeletionCleanup,
}));

vi.mock("@zoonk/auth/native-apple", () => ({
  reauthorizeAppleForAccountDeletion: mocks.reauthorizeApple,
}));

vi.mock("next/headers", () => ({ headers: mocks.getRequestHeaders }));

vi.mock("./get-session", () => ({ getSession: mocks.getSession }));

const appleCredentials = {
  authorizationCode: "single-use-code",
  idToken: "apple-id-token",
  nonce: "raw-nonce",
};

const emailCredentials = { email: "learner@example.com", otp: "123456" };

/**
 * Adds the provider row that changes deletion reauthentication behavior while
 * leaving the account lookup itself on the real Prisma client.
 */
function createAppleAccount(userId: string) {
  return prisma.account.create({
    data: { accountId: `apple-${randomUUID()}`, providerId: "apple", userId },
  });
}

describe(deleteCurrentUser, () => {
  let currentUserId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const currentUser = await userFixture();
    currentUserId = currentUser.id;
    mocks.deleteUser.mockResolvedValue({ success: true });

    mocks.captureDeletionCleanup.mockImplementation(async (operation: () => Promise<unknown>) => ({
      appleAuthorizationRevoked: null,
      result: await operation(),
    }));

    mocks.getRequestHeaders.mockResolvedValue(
      new Headers({ authorization: "Bearer current-token", cookie: "session=stale-cookie" }),
    );

    mocks.getSession.mockResolvedValue({ user: { id: currentUserId } });

    mocks.reauthorizeEmail.mockResolvedValue({ sessionToken: "fresh-email-session" });

    mocks.reauthorizeApple.mockResolvedValue({
      appleAuthorizationRevoked: true,
      sessionToken: "fresh-apple-session",
    });
  });

  it("deletes a non-Apple account with its authoritative request session", async () => {
    await expect(deleteCurrentUser({})).resolves.toStrictEqual({ appleAuthorizationRevoked: null });

    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith({
      body: {},
      headers: expect.any(Headers),
    });

    expect(mocks.reauthorizeApple).not.toHaveBeenCalled();
  });

  it("keeps deletion available without fresh Apple credentials", async () => {
    await createAppleAccount(currentUserId);

    mocks.captureDeletionCleanup.mockImplementation(async (operation: () => Promise<unknown>) => ({
      appleAuthorizationRevoked: true,
      result: await operation(),
    }));

    await expect(deleteCurrentUser({})).resolves.toStrictEqual({ appleAuthorizationRevoked: true });

    expect(mocks.reauthorizeApple).not.toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalledOnce();
  });

  it("deletes with the fresh session returned after native Apple revocation", async () => {
    await createAppleAccount(currentUserId);

    mocks.captureDeletionCleanup.mockImplementation(async (operation: () => Promise<unknown>) => ({
      appleAuthorizationRevoked: true,
      result: await operation(),
    }));

    await expect(deleteCurrentUser({ appleCredentials })).resolves.toStrictEqual({
      appleAuthorizationRevoked: true,
    });

    expect(mocks.reauthorizeApple).toHaveBeenCalledExactlyOnceWith({
      credentials: appleCredentials,
      expectedUserId: currentUserId,
    });

    const deletionHeaders = mocks.deleteUser.mock.calls[0]?.[0].headers as Headers;
    expect(deletionHeaders.get("authorization")).toBe("Bearer fresh-apple-session");
    expect(deletionHeaders.has("cookie")).toBe(false);
  });

  it("deletes with the fresh session returned by atomic email OTP reauthentication", async () => {
    await expect(deleteCurrentUser({ emailCredentials })).resolves.toStrictEqual({
      appleAuthorizationRevoked: null,
    });

    expect(mocks.reauthorizeEmail).toHaveBeenCalledExactlyOnceWith({
      credentials: emailCredentials,
      expectedUserId: currentUserId,
    });

    const deletionHeaders = mocks.deleteUser.mock.calls[0]?.[0].headers as Headers;
    expect(deletionHeaders.get("authorization")).toBe("Bearer fresh-email-session");
    expect(deletionHeaders.has("cookie")).toBe(false);
  });

  it("reports stored Apple revocation failure after email reauthentication", async () => {
    await createAppleAccount(currentUserId);

    mocks.captureDeletionCleanup.mockImplementation(async (operation: () => Promise<unknown>) => ({
      appleAuthorizationRevoked: false,
      result: await operation(),
    }));

    await expect(deleteCurrentUser({ emailCredentials })).resolves.toStrictEqual({
      appleAuthorizationRevoked: false,
    });
  });

  it("reports failure when either fresh or stored Apple revocation is unavailable", async () => {
    await createAppleAccount(currentUserId);

    mocks.captureDeletionCleanup.mockImplementation(async (operation: () => Promise<unknown>) => ({
      appleAuthorizationRevoked: false,
      result: await operation(),
    }));

    await expect(deleteCurrentUser({ appleCredentials })).resolves.toStrictEqual({
      appleAuthorizationRevoked: false,
    });
  });

  it.each([
    { input: { appleCredentials }, provider: "Apple" },
    { input: { emailCredentials }, provider: "email" },
  ])("removes a temporary $provider session when deletion fails", async ({ input, provider }) => {
    const deletionError = new Error("database unavailable");
    const temporarySessionToken = `${provider.toLowerCase()}-${randomUUID()}`;

    if (provider === "Apple") {
      await createAppleAccount(currentUserId);

      mocks.reauthorizeApple.mockResolvedValue({
        appleAuthorizationRevoked: true,
        sessionToken: temporarySessionToken,
      });
    } else {
      mocks.reauthorizeEmail.mockResolvedValue({ sessionToken: temporarySessionToken });
    }

    await prisma.session.create({
      data: {
        expiresAt: new Date(Date.now() + 60_000),
        token: temporarySessionToken,
        userId: currentUserId,
      },
    });

    mocks.deleteUser.mockRejectedValue(deletionError);

    await expect(deleteCurrentUser(input)).rejects.toBe(deletionError);

    await expect(
      prisma.session.findUnique({ where: { token: temporarySessionToken } }),
    ).resolves.toBeNull();
  });
});
