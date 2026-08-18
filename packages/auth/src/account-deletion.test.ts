import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureAccountDeletionCleanup,
  deleteUserDependenciesBeforeAuthDelete,
} from "./account-deletion";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_PROVIDER_ID = "apple";

const mocks = vi.hoisted(() => ({
  cancelStripeSubscription: vi.fn(),
  revokeStoredAppleAuthorization: vi.fn(),
}));

vi.mock("./providers/apple-revocation", () => ({
  revokeStoredAppleAuthorization: mocks.revokeStoredAppleAuthorization,
}));

vi.mock("./stripe/client", () => ({
  stripeClient: { subscriptions: { cancel: mocks.cancelStripeSubscription } },
}));

/**
 * Creates an isolated persisted user so cleanup assertions exercise the same
 * foreign keys and cascades as production instead of reproducing Prisma in a mock.
 */
function createTestUser() {
  const id = randomUUID();

  return prisma.user.create({
    data: { email: `account-deletion-${id}@example.test`, id, name: "Deletion Test User" },
  });
}

/**
 * Creates the smallest real course shape needed to prove membership cleanup
 * updates denormalized learner counts without coupling this package to shared fixtures.
 */
function createTestCourse({ userId }: { userId: null | string }) {
  const id = randomUUID();

  return prisma.course.create({
    data: {
      language: "en",
      normalizedTitle: `account deletion ${id}`,
      slug: `account-deletion-${id}`,
      title: "Account deletion test course",
      userCount: 1,
      userId,
    },
  });
}

describe(deleteUserDependenciesBeforeAuthDelete, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cancelStripeSubscription.mockResolvedValue({ id: "sub_active" });
    mocks.revokeStoredAppleAuthorization.mockResolvedValue(true);
  });

  it("removes local subscription records", async () => {
    const user = await createTestUser();

    const subscription = await prisma.subscription.create({
      data: {
        id: randomUUID(),
        plan: "plus",
        provider: "zoonk",
        referenceId: user.id,
        status: "active",
      },
    });

    await deleteUserDependenciesBeforeAuthDelete(user);

    await expect(
      prisma.subscription.findUnique({ where: { id: subscription.id } }),
    ).resolves.toBeNull();
  });

  it("cancels Stripe billing before removing the local subscription", async () => {
    const user = await createTestUser();

    const subscription = await prisma.subscription.create({
      data: {
        id: randomUUID(),
        plan: "plus",
        provider: "stripe",
        referenceId: user.id,
        status: "active",
        stripeSubscriptionId: `sub_${randomUUID()}`,
      },
    });

    mocks.cancelStripeSubscription.mockImplementationOnce(async () => {
      await expect(
        prisma.subscription.findUnique({ where: { id: subscription.id } }),
      ).resolves.not.toBeNull();

      return { id: subscription.stripeSubscriptionId };
    });

    await deleteUserDependenciesBeforeAuthDelete(user);

    expect(mocks.cancelStripeSubscription).toHaveBeenCalledExactlyOnceWith(
      subscription.stripeSubscriptionId,
    );

    await expect(
      prisma.subscription.findUnique({ where: { id: subscription.id } }),
    ).resolves.toBeNull();
  });

  it("removes course memberships and decrements every surviving course user count", async () => {
    const [deletingUser, otherOwner] = await Promise.all([createTestUser(), createTestUser()]);

    const [sharedCourse, otherOwnedCourse, deletingUserOwnedCourse] = await Promise.all([
      createTestCourse({ userId: null }),
      createTestCourse({ userId: otherOwner.id }),
      createTestCourse({ userId: deletingUser.id }),
    ]);

    await prisma.courseUser.createMany({
      data: [sharedCourse, otherOwnedCourse, deletingUserOwnedCourse].map((course) => ({
        courseId: course.id,
        userId: deletingUser.id,
      })),
    });

    await deleteUserDependenciesBeforeAuthDelete(deletingUser);

    const [membershipCount, updatedSharedCourse, updatedOtherOwnedCourse, ownedCourse] =
      await Promise.all([
        prisma.courseUser.count({ where: { userId: deletingUser.id } }),
        prisma.course.findUniqueOrThrow({ where: { id: sharedCourse.id } }),
        prisma.course.findUniqueOrThrow({ where: { id: otherOwnedCourse.id } }),
        prisma.course.findUniqueOrThrow({ where: { id: deletingUserOwnedCourse.id } }),
      ]);

    expect(membershipCount).toBe(0);
    expect(updatedSharedCourse.userCount).toBe(0);
    expect(updatedOtherOwnedCourse.userCount).toBe(0);
    expect(ownedCourse.userCount).toBe(1);
  });

  it("attempts stored Apple revocation before removing local account state", async () => {
    const user = await createTestUser();
    const normalizedEmail = user.email.toLowerCase();

    const verificationIdentifiers = [
      `email-verification-otp-${normalizedEmail}`,
      `sign-in-otp-${normalizedEmail}`,
      `forget-password-otp-${normalizedEmail}`,
    ];

    await Promise.all([
      prisma.account.create({
        data: {
          accountId: `apple-${randomUUID()}`,
          idToken: "stored-id-token",
          issuer: APPLE_ISSUER,
          providerId: APPLE_PROVIDER_ID,
          refreshToken: "stored-refresh-token",
          userId: user.id,
        },
      }),
      prisma.verification.createMany({
        data: verificationIdentifiers.map((identifier) => ({
          expiresAt: new Date(Date.now() + 60_000),
          identifier,
          value: "123456",
        })),
      }),
    ]);

    mocks.revokeStoredAppleAuthorization.mockImplementationOnce(async () => {
      await expect(
        prisma.verification.count({ where: { identifier: { in: verificationIdentifiers } } }),
      ).resolves.toBe(3);

      return false;
    });

    const cleanup = await captureAccountDeletionCleanup(async () => {
      await deleteUserDependenciesBeforeAuthDelete(user);
      return "deleted" as const;
    });

    expect(cleanup).toStrictEqual({ appleAuthorizationRevoked: false, result: "deleted" });

    expect(mocks.revokeStoredAppleAuthorization).toHaveBeenCalledExactlyOnceWith({
      idToken: "stored-id-token",
      refreshToken: "stored-refresh-token",
    });

    await expect(
      prisma.verification.count({ where: { identifier: { in: verificationIdentifiers } } }),
    ).resolves.toBe(0);
  });
});
