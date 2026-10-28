import { acknowledgeGooglePlaySubscription } from "./google-play-api";
import { GooglePlayError } from "./google-play-error";
import { type GooglePlaySubscriptionProduct } from "./google-play-products";
import { type VerifiedGooglePlaySubscription } from "./google-play-purchase";
import {
  StoreSubscriptionConflictError,
  type StoreSubscriptionSnapshot,
  reconcileStoreSubscription,
} from "./reconcile-store-subscription";

type ReconcileGooglePlaySubscriptionInput = {
  eventId: string | null;
  product: GooglePlaySubscriptionProduct;
  purchase: VerifiedGooglePlaySubscription;
  referenceId: string;
};

function getGooglePlaySubscriptionSnapshot({
  eventId,
  product,
  purchase,
  referenceId,
}: ReconcileGooglePlaySubscriptionInput): StoreSubscriptionSnapshot {
  const cancelAtPeriodEnd = purchase.isActive && !purchase.isAutoRenewEnabled;

  return {
    billingInterval: product.billingInterval,
    cancelAt: cancelAtPeriodEnd ? purchase.expiryTime : null,
    cancelAtPeriodEnd,
    canceledAt: purchase.canceledAt,
    /** Revocation, hold and pause end access now even when the period would have run longer. */
    endedAt: purchase.isActive
      ? null
      : new Date(Math.min(purchase.expiryTime.getTime(), purchase.readAt.getTime())),
    periodEnd: purchase.expiryTime,
    periodStart: purchase.startTime,
    plan: product.plan,
    provider: "google",
    providerEnvironment: purchase.environment,
    providerEventId: eventId,
    providerProductId: purchase.basePlanId
      ? `${purchase.productId}:${purchase.basePlanId}`
      : purchase.productId,
    providerSignedAt: purchase.readAt,
    providerSubscriptionId: purchase.purchaseToken,
    providerTransactionId: purchase.orderId,
    referenceId,
    status: purchase.isActive ? "active" : "canceled",
  };
}

/**
 * Acknowledges a granted purchase before saving it, so a saved notification never hides an
 * acknowledgement that failed: a retry reads the purchase again and acknowledges what's left.
 * A purchase token never moves between accounts.
 */
export async function reconcileGooglePlaySubscription(input: ReconcileGooglePlaySubscriptionInput) {
  const { purchase, referenceId } = input;

  if (purchase.isActive && !purchase.isAcknowledged) {
    await acknowledgeGooglePlaySubscription({
      accountId: purchase.hasOwnAccountId ? undefined : referenceId,
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    });
  }

  try {
    return await reconcileStoreSubscription(getGooglePlaySubscriptionSnapshot(input), {
      replacedSubscriptionId: purchase.isActive ? purchase.linkedPurchaseToken : null,
    });
  } catch (error) {
    if (error instanceof StoreSubscriptionConflictError) {
      throw new GooglePlayError("conflict", { cause: error });
    }

    throw error;
  }
}
