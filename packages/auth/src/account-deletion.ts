import { AsyncLocalStorage } from "node:async_hooks";
import { type TransactionClient, prisma } from "@zoonk/db";
import { revokeStoredAppleAuthorization } from "./providers/apple-revocation";

type AccountDeletionCleanupReporter = {
  reportAppleAuthorizationRevocation: (revoked: boolean | null) => void;
};

const accountDeletionCleanupReporter = new AsyncLocalStorage<AccountDeletionCleanupReporter>();

/**
 * Runs Better Auth's user deletion with a request-local channel for provider
 * cleanup results. Better Auth intentionally ignores beforeDelete return
 * values, so this keeps concurrent deletions isolated while still letting the
 * API tell one user whether their own Apple grant was revoked.
 */
export async function captureAccountDeletionCleanup<Result>(operation: () => Promise<Result>) {
  const appleRevocation = Promise.withResolvers<boolean | null>();

  const result = await accountDeletionCleanupReporter.run(
    { reportAppleAuthorizationRevocation: appleRevocation.resolve },
    operation,
  );

  return { appleAuthorizationRevoked: await appleRevocation.promise, result };
}

/**
 * Revokes every Apple grant before its Account row is removed because Sign in
 * with Apple requires token revocation when a user deletes their account. The
 * provider helper deliberately converts missing legacy tokens and Apple outages
 * into false outcomes so users are never prevented from deleting Zoonk data.
 */
async function revokeAppleAuthorizations(userId: string) {
  const accounts = await prisma.account.findMany({ where: { providerId: "apple", userId } });

  if (accounts.length === 0) {
    return null;
  }

  const revocationResults = await Promise.all(
    accounts.map(({ idToken, refreshToken }) =>
      revokeStoredAppleAuthorization({ idToken, refreshToken }),
    ),
  );

  return revocationResults.every(Boolean);
}

/**
 * Lists the exact Better Auth email OTP rows that may still contain the user's
 * normalized address. Change-email OTPs are excluded because that capability
 * is disabled; broad matching could remove another user's pending code.
 */
function getEmailOTPIdentifiers(email: string) {
  const normalizedEmail = email.toLowerCase();

  return [
    `email-verification-otp-${normalizedEmail}`,
    `sign-in-otp-${normalizedEmail}`,
    `forget-password-otp-${normalizedEmail}`,
  ];
}

type CourseMembershipOwnership = { course: { userId: string | null }; courseId: string };

/**
 * Returns every course that survives deletion of this user. A course owned by
 * someone else survives just like a shared course, so its denormalized learner
 * count must also change. Only courses owned by the deleting user are skipped
 * because the User foreign-key cascade removes those course rows entirely.
 */
function getSurvivingCourseIds({
  deletingUserId,
  memberships,
}: {
  deletingUserId: string;
  memberships: CourseMembershipOwnership[];
}) {
  return memberships
    .filter((membership) => membership.course.userId !== deletingUserId)
    .map((membership) => membership.courseId);
}

/**
 * Removes the learner's course memberships before the User cascade and keeps
 * surviving course counts accurate in the same transaction. Reading membership
 * IDs first makes the decrement retry-safe: a retry finds no removed rows and
 * therefore cannot decrement the same course twice.
 */
async function removeCourseMemberships(userId: string) {
  await prisma.$transaction(async (transaction: TransactionClient) => {
    const memberships = await transaction.courseUser.findMany({
      include: { course: { select: { userId: true } } },
      where: { userId },
    });

    const survivingCourseIds = getSurvivingCourseIds({ deletingUserId: userId, memberships });

    if (survivingCourseIds.length === 0) {
      await transaction.courseUser.deleteMany({ where: { userId } });
      return;
    }

    await Promise.all([
      transaction.courseUser.deleteMany({ where: { userId } }),
      transaction.course.updateMany({
        data: { userCount: { decrement: 1 } },
        where: { id: { in: survivingCourseIds }, userCount: { gt: 0 } },
      }),
    ]);
  });
}

/**
 * Removes every non-relational local dependency before the User cascade runs.
 * These independent deletes are idempotent, so a later Better Auth failure can
 * be retried without retaining subscriptions or email OTP identifiers.
 */
async function deleteLocalUserDependencies({ email, userId }: { email: string; userId: string }) {
  await Promise.all([
    removeCourseMemberships(userId),
    prisma.subscription.deleteMany({ where: { referenceId: userId } }),
    prisma.verification.deleteMany({
      where: { identifier: { in: getEmailOTPIdentifiers(email) } },
    }),
  ]);
}

/**
 * Cleans up records that cannot rely on the User foreign-key cascade. Better
 * Auth invokes this hook only after it validates the authoritative session and
 * its freshness, so stale credentials cannot revoke Apple access or remove data.
 */
export async function deleteUserDependenciesBeforeAuthDelete(user: { email: string; id: string }) {
  const appleAuthorizationRevoked = await revokeAppleAuthorizations(user.id);

  accountDeletionCleanupReporter
    .getStore()
    ?.reportAppleAuthorizationRevocation(appleAuthorizationRevoked);

  await deleteLocalUserDependencies({ email: user.email, userId: user.id });
}
