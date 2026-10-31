import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@zoonk/db";
import { anonymizeLearnerRecords } from "@zoonk/db/anonymous-records";
import { revokeStoredAppleAuthorization } from "./providers/apple-revocation";
import { stripeClient } from "./stripe/client";
import { deleteUserBlobs } from "./user-blobs";

type DeletedUser = { email: string; id: string; name: string };
type EndWebPlus = (user: DeletedUser) => Promise<void>;

type AccountDeletionCleanup = {
  endWebPlus: EndWebPlus;
  reportAppleAuthorizationRevocation: (revoked: boolean | null) => void;
};

const accountDeletionCleanup = new AsyncLocalStorage<AccountDeletionCleanup>();

/** Stripe can't cancel these again. */
const ENDED_STATUSES = ["canceled", "incomplete_expired"];

/** Keeping a long-time learner's anonymous records copies all their answers, past the default. */
const ANONYMIZE_TIMEOUT_MS = 60_000;

/**
 * Better Auth ignores `beforeDelete`'s return value and core's Plus refunds can't live here, so
 * both travel through a request-local channel. Without it, website Plus is canceled unrefunded.
 */
export async function captureAccountDeletionCleanup<Result>({
  endWebPlus,
  operation,
}: {
  endWebPlus: EndWebPlus;
  operation: () => Promise<Result>;
}) {
  const appleRevocation = Promise.withResolvers<boolean | null>();

  const result = await accountDeletionCleanup.run(
    { endWebPlus, reportAppleAuthorizationRevocation: appleRevocation.resolve },
    operation,
  );

  return { appleAuthorizationRevoked: await appleRevocation.promise, result };
}

/** Sign in with Apple requires revoking the token when a user deletes their account. */
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

/** Exact identifiers only: broad matching could remove another user's pending code. */
function getEmailOTPIdentifiers(email: string) {
  const normalizedEmail = email.toLowerCase();

  return [
    `email-verification-otp-${normalizedEmail}`,
    `sign-in-otp-${normalizedEmail}`,
    `forget-password-otp-${normalizedEmail}`,
  ];
}

/**
 * What the learner's study teaches everyone is kept anonymously, and their feedback without their
 * email. Idempotent, so a later Better Auth failure can be retried.
 */
async function deleteLocalUserDependencies({ email, userId }: { email: string; userId: string }) {
  await Promise.all([
    prisma.subscription.deleteMany({ where: { referenceId: userId } }),
    prisma.verification.deleteMany({
      where: { identifier: { in: getEmailOTPIdentifiers(email) } },
    }),
    prisma.$transaction(
      (transaction) => anonymizeLearnerRecords({ emails: [email], transaction, userIds: [userId] }),
      { timeout: ANONYMIZE_TIMEOUT_MS },
    ),
  ]);
}

export function isAccountDeletionCleanupReady(): boolean {
  return accountDeletionCleanup.getStore() !== undefined;
}

/**
 * App Store and Google Play don't let a server cancel a user's purchase, so only Stripe is canceled
 * here, once `endWebPlus` has ended the live one.
 */
async function cancelStripeSubscriptions(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      provider: "stripe",
      referenceId: userId,
      status: { notIn: ENDED_STATUSES },
      stripeSubscriptionId: { not: null },
    },
  });

  const subscriptionIds = subscriptions
    .map(({ stripeSubscriptionId }) => stripeSubscriptionId)
    .filter((subscriptionId): subscriptionId is string => Boolean(subscriptionId));

  await Promise.all(
    subscriptionIds.map((subscriptionId) => stripeClient.subscriptions.cancel(subscriptionId)),
  );
}

export async function deleteUserDependenciesBeforeAuthDelete(user: DeletedUser) {
  const cleanup = accountDeletionCleanup.getStore();

  // First, before anything that can't be undone, so a failure stops the deletion and a retry finishes it.
  await deleteUserBlobs(user.id);

  const appleAuthorizationRevoked = await revokeAppleAuthorizations(user.id);
  cleanup?.reportAppleAuthorizationRevocation(appleAuthorizationRevoked);

  await cleanup?.endWebPlus(user);
  await cancelStripeSubscriptions(user.id);
  await deleteLocalUserDependencies({ email: user.email, userId: user.id });
}
