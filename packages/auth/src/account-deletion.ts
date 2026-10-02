import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@zoonk/db";
import { revokeStoredAppleAuthorization } from "./providers/apple-revocation";
import { stripeClient } from "./stripe/client";
import { deleteUserBlobs } from "./user-blobs";

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

/**
 * Removes local dependencies that must be gone before the User cascade runs.
 * The explicit subscription cleanup closes the normal deletion path promptly;
 * user-owned store rows also have a cascade so a concurrent notification cannot
 * survive the later User deletion. These independent deletes are idempotent, so
 * a later Better Auth failure can be retried safely.
 */
async function deleteLocalUserDependencies({ email, userId }: { email: string; userId: string }) {
  await Promise.all([
    prisma.subscription.deleteMany({ where: { referenceId: userId } }),
    prisma.verification.deleteMany({
      where: { identifier: { in: getEmailOTPIdentifiers(email) } },
    }),
  ]);
}

/**
 * Stops Stripe billing before its local lookup row is removed. App Store and
 * Google Play subscriptions remain store-managed because those providers do
 * not let Zoonk cancel a user's purchase from this server deletion hook.
 */
async function cancelStripeSubscriptions(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { provider: "stripe", referenceId: userId, stripeSubscriptionId: { not: null } },
  });

  const subscriptionIds = subscriptions
    .map(({ stripeSubscriptionId }) => stripeSubscriptionId)
    .filter((subscriptionId): subscriptionId is string => Boolean(subscriptionId));

  await Promise.all(
    subscriptionIds.map((subscriptionId) => stripeClient.subscriptions.cancel(subscriptionId)),
  );
}

/**
 * Deletes the learner's private files, then cleans provider state and local
 * records that need work before the User foreign-key cascade. Better Auth
 * invokes this hook only after it validates the authoritative session and its
 * freshness, so stale credentials cannot revoke Apple access or remove data.
 */
export async function deleteUserDependenciesBeforeAuthDelete(user: { email: string; id: string }) {
  // First, before anything that can't be undone: a failure here stops the deletion, and a retry
  // finishes it, so a learner's uploads and private pictures never outlive their account.
  await deleteUserBlobs(user.id);

  const appleAuthorizationRevoked = await revokeAppleAuthorizations(user.id);

  accountDeletionCleanupReporter
    .getStore()
    ?.reportAppleAuthorizationRevocation(appleAuthorizationRevoked);

  await cancelStripeSubscriptions(user.id);
  await deleteLocalUserDependencies({ email: user.email, userId: user.id });
}
