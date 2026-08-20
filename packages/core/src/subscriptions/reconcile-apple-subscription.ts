import { type Subscription, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { revalidateTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../cache/tags";
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

/**
 * Repeats the signed-date guard in SQL so concurrent deliveries cannot let an older event win
 * after the initial read.
 */
async function updateExistingAppleSubscription({
  existing,
  input,
}: {
  existing: Subscription;
  input: ReconcileAppleSubscriptionInput;
}) {
  if (existing.referenceId !== input.referenceId) {
    throw new AppleSubscriptionError("conflict");
  }

  if (isStaleAppleSubscription({ existing, verifiedSubscription: input.verifiedSubscription })) {
    return existing;
  }

  const update = await prisma.subscription.updateMany({
    data: getAppleSubscriptionData(input),
    where: {
      OR: [
        { providerSignedAt: null },
        { providerSignedAt: { lt: input.verifiedSubscription.eventSignedDate } },
      ],
      id: existing.id,
    },
  });

  if (update.count === 1) {
    return prisma.subscription.findUniqueOrThrow({ where: { id: existing.id } });
  }

  return prisma.subscription.findUniqueOrThrow({
    where: {
      provider_providerSubscriptionId: {
        provider: "apple",
        providerSubscriptionId: input.verifiedSubscription.originalTransactionId,
      },
    },
  });
}

/**
 * The provider-chain unique key resolves concurrent first deliveries to the same row instead
 * of creating duplicate entitlements.
 */
async function createAppleSubscription(input: ReconcileAppleSubscriptionInput) {
  try {
    return await prisma.subscription.create({ data: getAppleSubscriptionData(input) });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await findAppleSubscription(input.verifiedSubscription.originalTransactionId);

    if (!existing) {
      throw error;
    }

    return updateExistingAppleSubscription({ existing, input });
  }
}

export function findAppleSubscription(providerSubscriptionId: string) {
  return prisma.subscription.findUnique({
    where: { provider_providerSubscriptionId: { provider: "apple", providerSubscriptionId } },
  });
}

/** Persists one ordered provider snapshot and expires every cached entitlement derived from it. */
export async function reconcileAppleSubscription(input: ReconcileAppleSubscriptionInput) {
  const existing = await findAppleSubscription(input.verifiedSubscription.originalTransactionId);

  const subscription = await (existing
    ? updateExistingAppleSubscription({ existing, input })
    : createAppleSubscription(input));

  revalidateTag(getUserSubscriptionCacheTag(input.referenceId), { expire: 0 });
  return subscription;
}
