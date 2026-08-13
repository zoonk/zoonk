import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailAccountDeletionError } from "./email-deletion-contract";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";

const mocks = vi.hoisted(() => ({
  betterAuth: vi.fn(),
  emailOTP: vi.fn(),
  signInEmailOTP: vi.fn(),
}));

vi.mock("better-auth/minimal", () => ({ betterAuth: mocks.betterAuth }));
vi.mock("better-auth/plugins", () => ({ emailOTP: mocks.emailOTP }));
vi.mock("./plugins/otp", () => ({ sendVerificationOTP: vi.fn() }));
vi.mock("./server", () => ({ baseAuthConfig: {}, baseAuthPlugins: [] }));

const credentials = { email: "learner@example.com", otp: "123456" };

/**
 * Persists the user and session returned by the mocked OTP provider so identity
 * mismatch cleanup is verified through Prisma rather than a database-shaped spy.
 */
async function createTestSession() {
  const userId = randomUUID();
  const token = `email-reauthentication-${randomUUID()}`;

  await prisma.user.create({
    data: {
      email: `email-reauthentication-${userId}@example.test`,
      id: userId,
      name: "Email Reauthentication Test User",
      sessions: { create: { expiresAt: new Date(Date.now() + 60_000), token } },
    },
  });

  return { token, userId };
}

describe(createEmailDeletionReauthentication, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.betterAuth.mockReturnValue({ api: { signInEmailOTP: mocks.signInEmailOTP } });
    mocks.emailOTP.mockImplementation((options) => ({ id: "email-otp", options }));

    mocks.signInEmailOTP.mockResolvedValue({
      token: "fresh-email-session",
      user: { id: "user-id" },
    });
  });

  it.each(["hashed", "plain"] as const)(
    "uses Better Auth's atomic, non-signup OTP flow with %s storage",
    async (storeOTP) => {
      const reauthorize = createEmailDeletionReauthentication({
        rateLimit: { enabled: false },
        storeOTP,
      });

      await expect(reauthorize({ credentials, expectedUserId: "user-id" })).resolves.toStrictEqual({
        sessionToken: "fresh-email-session",
      });

      expect(mocks.emailOTP).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ disableSignUp: true, storeOTP }),
      );

      expect(mocks.signInEmailOTP).toHaveBeenCalledExactlyOnceWith({ body: credentials });
    },
  );

  it("removes the temporary session when the verified email belongs to another user", async () => {
    const session = await createTestSession();

    mocks.signInEmailOTP.mockResolvedValue({ token: session.token, user: { id: session.userId } });

    const reauthorize = createEmailDeletionReauthentication({
      rateLimit: { enabled: false },
      storeOTP: "hashed",
    });

    await expect(reauthorize({ credentials, expectedUserId: randomUUID() })).rejects.toBeInstanceOf(
      EmailAccountDeletionError,
    );

    await expect(
      prisma.session.findUnique({ where: { token: session.token } }),
    ).resolves.toBeNull();
  });

  it("leaves existing sessions untouched when Better Auth rejects the OTP", async () => {
    const session = await createTestSession();
    const invalidOTP = new Error("Invalid OTP");
    mocks.signInEmailOTP.mockRejectedValue(invalidOTP);

    const reauthorize = createEmailDeletionReauthentication({
      rateLimit: { enabled: false },
      storeOTP: "plain",
    });

    await expect(reauthorize({ credentials, expectedUserId: session.userId })).rejects.toBe(
      invalidOTP,
    );

    await expect(
      prisma.session.findUnique({ where: { token: session.token } }),
    ).resolves.not.toBeNull();
  });
});
