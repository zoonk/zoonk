import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailAccountDeletionError } from "./email-deletion-contract";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";

const mocks = vi.hoisted(() => ({
  betterAuth: vi.fn(),
  deleteSession: vi.fn(),
  emailOTP: vi.fn(),
  signInEmailOTP: vi.fn(),
}));

vi.mock("better-auth/minimal", () => ({ betterAuth: mocks.betterAuth }));
vi.mock("better-auth/plugins", () => ({ emailOTP: mocks.emailOTP }));
vi.mock("@zoonk/db", () => ({ prisma: { session: { deleteMany: mocks.deleteSession } } }));
vi.mock("./plugins/otp", () => ({ sendVerificationOTP: vi.fn() }));
vi.mock("./server", () => ({ baseAuthConfig: {}, baseAuthPlugins: [] }));

const credentials = { email: "learner@example.com", otp: "123456" };

describe(createEmailDeletionReauthentication, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.betterAuth.mockReturnValue({ api: { signInEmailOTP: mocks.signInEmailOTP } });
    mocks.deleteSession.mockResolvedValue({ count: 1 });
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
    mocks.signInEmailOTP.mockResolvedValue({
      token: "other-user-session",
      user: { id: "other-user-id" },
    });

    const reauthorize = createEmailDeletionReauthentication({
      rateLimit: { enabled: false },
      storeOTP: "hashed",
    });

    await expect(reauthorize({ credentials, expectedUserId: "user-id" })).rejects.toBeInstanceOf(
      EmailAccountDeletionError,
    );

    expect(mocks.deleteSession).toHaveBeenCalledExactlyOnceWith({
      where: { token: "other-user-session" },
    });
  });

  it("does not create or clean up a session when Better Auth rejects the OTP", async () => {
    const invalidOTP = new Error("Invalid OTP");
    mocks.signInEmailOTP.mockRejectedValue(invalidOTP);

    const reauthorize = createEmailDeletionReauthentication({
      rateLimit: { enabled: false },
      storeOTP: "plain",
    });

    await expect(reauthorize({ credentials, expectedUserId: "user-id" })).rejects.toBe(invalidOTP);

    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });
});
