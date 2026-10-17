import { type Subscription, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { type AppleSubscriptionProduct } from "./apple-products";
import { type VerifiedAppleSubscription } from "./apple-store-payload";
import { AppleSubscriptionError } from "./apple-subscription-error";

type ReconcileAppleSubscriptionInput = {
  product: AppleSubscriptionProduct;
  referenceId: string;
  verifiedSubscription: VerifiedAppleSubscription;
};

function getAppleSubscriptionData({
  product,
  referenceId,
  verifiedSubscription,
}: ReconcileAppleSubscriptionInput) {
  const cancelAtPeriodEnd =
    verifiedSubscription.isActive && !verifiedSubscription.isAutoRenewEnabled;

  return {
    billingInterval: product.billingInterval,
    cancelAt: cancelAtPeriodEnd ? verifiedSubscription.expirationDate : null,
    cancelAtPeriodEnd,
    canceledAt: cancelAtPeriodEnd ? verifiedSubscription.eventSignedDate : null,
    endedAt: verifiedSubscription.isActive
      ? null
      : (verifiedSubscription.revocationDate ?? verifiedSubscription.expirationDate),
    periodEnd: verifiedSubscription.expirationDate,
    periodStart: verifiedSubscription.purchaseDate,
    plan: product.plan,
    provider: "apple" as const,
    providerEnvironment: verifiedSubscription.environment,
    providerEventId: verifiedSubscription.eventId,
    providerProductId: verifiedSubscription.productId,
    providerSignedAt: verifiedSubscription.eventSignedDate,
    providerSubscriptionId: verifiedSubscription.originalTransactionId,
    providerTransactionId: verifiedSubscription.transactionId,
    referenceId,
    status: verifiedSubscription.isActive ? "active" : "canceled",
    userId: referenceId,
  };
}

/**
 * Apple retries notifications and can deliver them out of order, so only a strictly newer
 * signed event may replace the stored snapshot.
 */
function isStaleAppleSubscription({
  existing,
  verifiedSubscription,
}: {
  existing: Subscription;
  verifiedSubscription: VerifiedAppleSubscription;
}) {
  if (verifiedSubscription.eventId && existing.providerEventId === verifiedSubscription.eventId) {
    return true;
  }

  return Boolean(
    existing.providerSignedAt && existing.providerSignedAt >= verifiedSubscription.eventSignedDate,
  );
}

/** A snapshot and its entitlement/input markers commit together, including first delivery. */
function writeAppleSubscription(input: ReconcileAppleSubscriptionInput) {
  return writeLearnerChange({ planInputs: true, userId: input.referenceId }, async (tx) => {
    const existing = await tx.subscription.findUnique({
      where: {
        provider_providerSubscriptionId: {
          provider: "apple",
          providerSubscriptionId: input.verifiedSubscription.originalTransactionId,
        },
      },
    });

    if (!existing) {
      return tx.subscription.create({ data: getAppleSubscriptionData(input) });
    }

    if (existing.referenceId !== input.referenceId) {
      throw new AppleSubscriptionError("conflict");
    }

    if (isStaleAppleSubscription({ existing, verifiedSubscription: input.verifiedSubscription })) {
      return unchanged(existing);
    }

    /** Preserve the signed-date predicate even when an older external writer races this one. */
    const { count } = await tx.subscription.updateMany({
      data: getAppleSubscriptionData(input),
      where: {
        OR: [
          { providerSignedAt: null },
          { providerSignedAt: { lt: input.verifiedSubscription.eventSignedDate } },
        ],
        id: existing.id,
      },
    });

    const current = await tx.subscription.findUniqueOrThrow({ where: { id: existing.id } });
    return count === 0 ? unchanged(current) : current;
  });
}

export function findAppleSubscription(providerSubscriptionId: string) {
  return prisma.subscription.findUnique({
    where: { provider_providerSubscriptionId: { provider: "apple", providerSubscriptionId } },
  });
}

/** Persists one ordered provider snapshot and expires every cached entitlement derived from it. */
export async function reconcileAppleSubscription(input: ReconcileAppleSubscriptionInput) {
  const subscription = await writeAppleSubscription(input).catch((error: unknown) => {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    /** A different account can race the provider-chain key: retry after the losing tx rolled back. */
    return writeAppleSubscription(input);
  });

  revalidateCacheTags([getUserSubscriptionCacheTag(input.referenceId)]);
  return subscription;
}
