import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureAccountDeletionCleanup,
  deleteUserDependenciesBeforeAuthDelete,
} from "./account-deletion";

const mocks = vi.hoisted(() => ({
  decrementCourseUserCounts: vi.fn(),
  deleteCourseMemberships: vi.fn(),
  deleteManySubscriptions: vi.fn(),
  deleteManyVerifications: vi.fn(),
  findAppleAccounts: vi.fn(),
  findCourseMemberships: vi.fn(),
  revokeStoredAppleAuthorization: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@zoonk/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    account: { findMany: mocks.findAppleAccounts },
    subscription: { deleteMany: mocks.deleteManySubscriptions },
    verification: { deleteMany: mocks.deleteManyVerifications },
  },
}));

vi.mock("./providers/apple-revocation", () => ({
  revokeStoredAppleAuthorization: mocks.revokeStoredAppleAuthorization,
}));

describe(deleteUserDependenciesBeforeAuthDelete, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteManySubscriptions.mockResolvedValue({ count: 1 });
    mocks.deleteManyVerifications.mockResolvedValue({ count: 1 });
    mocks.deleteCourseMemberships.mockResolvedValue({ count: 0 });
    mocks.decrementCourseUserCounts.mockResolvedValue({ count: 0 });
    mocks.findAppleAccounts.mockResolvedValue([]);
    mocks.findCourseMemberships.mockResolvedValue([]);
    mocks.revokeStoredAppleAuthorization.mockResolvedValue(true);

    mocks.transaction.mockImplementation(
      (
        operation: (transaction: {
          course: { updateMany: typeof mocks.decrementCourseUserCounts };
          courseUser: {
            deleteMany: typeof mocks.deleteCourseMemberships;
            findMany: typeof mocks.findCourseMemberships;
          };
        }) => Promise<unknown>,
      ) =>
        operation({
          course: { updateMany: mocks.decrementCourseUserCounts },
          courseUser: {
            deleteMany: mocks.deleteCourseMemberships,
            findMany: mocks.findCourseMemberships,
          },
        }),
    );
  });

  it("removes local subscription records", async () => {
    const userId = "019fcaf2-d5ef-7a12-aa82-f1228a863752";

    await deleteUserDependenciesBeforeAuthDelete({ email: "learner@example.com", id: userId });

    expect(mocks.deleteManySubscriptions).toHaveBeenCalledExactlyOnceWith({
      where: { referenceId: userId },
    });
  });

  it("removes course memberships and decrements every surviving course user count", async () => {
    const userId = "019fcaf2-d5ef-7a12-aa82-f1228a863756";

    mocks.findCourseMemberships.mockResolvedValue([
      { course: { userId: null }, courseId: "shared-course-id" },
      {
        course: { userId: "019fcaf2-d5ef-7a12-aa82-f1228a863757" },
        courseId: "other-user-owned-course-id",
      },
      { course: { userId }, courseId: "owned-course-id" },
    ]);

    await deleteUserDependenciesBeforeAuthDelete({ email: "learner@example.com", id: userId });

    expect(mocks.deleteCourseMemberships).toHaveBeenCalledExactlyOnceWith({ where: { userId } });

    expect(mocks.decrementCourseUserCounts).toHaveBeenCalledExactlyOnceWith({
      data: { userCount: { decrement: 1 } },
      where: {
        id: { in: ["shared-course-id", "other-user-owned-course-id"] },
        userCount: { gt: 0 },
      },
    });
  });

  it("attempts stored Apple revocation before removing local account state", async () => {
    const userId = "019fcaf2-d5ef-7a12-aa82-f1228a863755";

    mocks.findAppleAccounts.mockResolvedValue([
      { idToken: "stored-id-token", refreshToken: "stored-refresh-token" },
    ]);

    mocks.revokeStoredAppleAuthorization.mockResolvedValue(false);

    const cleanup = await captureAccountDeletionCleanup(async () => {
      await deleteUserDependenciesBeforeAuthDelete({ email: "Learner@Example.com", id: userId });
      return "deleted" as const;
    });

    expect(cleanup).toStrictEqual({ appleAuthorizationRevoked: false, result: "deleted" });

    expect(mocks.revokeStoredAppleAuthorization).toHaveBeenCalledExactlyOnceWith({
      idToken: "stored-id-token",
      refreshToken: "stored-refresh-token",
    });

    expect(mocks.deleteManySubscriptions).toHaveBeenCalledExactlyOnceWith({
      where: { referenceId: userId },
    });

    expect(mocks.deleteManyVerifications).toHaveBeenCalledExactlyOnceWith({
      where: {
        identifier: {
          in: [
            "email-verification-otp-learner@example.com",
            "sign-in-otp-learner@example.com",
            "forget-password-otp-learner@example.com",
          ],
        },
      },
    });
  });
});
