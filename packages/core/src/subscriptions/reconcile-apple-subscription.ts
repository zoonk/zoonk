import { type AppleSubscriptionProduct } from "./apple-products";
import { type VerifiedAppleSubscription } from "./apple-store-payload";
import { AppleSubscriptionError } from "./apple-subscription-error";
import {
  StoreSubscriptionConflictError,
  type StoreSubscriptionSnapshot,
  reconcileStoreSubscription,
} from "./reconcile-store-subscription";

type ReconcileAppleSubscriptionInput = {
  product: AppleSubscriptionProduct;
  referenceId: string;
  verifiedSubscription: VerifiedAppleSubscription;
};

function getAppleSubscriptionSnapshot({
  product,
  referenceId,
  verifiedSubscription,
}: ReconcileAppleSubscriptionInput): StoreSubscriptionSnapshot {
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
    provider: "apple",
    providerEnvironment: verifiedSubscription.environment,
    providerEventId: verifiedSubscription.eventId,
    providerProductId: verifiedSubscription.productId,
    providerSignedAt: verifiedSubscription.eventSignedDate,
    providerSubscriptionId: verifiedSubscription.originalTransactionId,
    providerTransactionId: verifiedSubscription.transactionId,
    referenceId,
    status: verifiedSubscription.isActive ? "active" : "canceled",
  };
}

/** Persists one signed App Store snapshot; an original transaction never moves between accounts. */
export async function reconcileAppleSubscription(input: ReconcileAppleSubscriptionInput) {
  try {
    return await reconcileStoreSubscription(getAppleSubscriptionSnapshot(input));
  } catch (error) {
    if (error instanceof StoreSubscriptionConflictError) {
      throw new AppleSubscriptionError("conflict", { cause: error });
    }

    throw error;
  }
}
