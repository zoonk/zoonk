import { safeAsync } from "@zoonk/utils/error";
import { acknowledgeGooglePlaySubscription, getGooglePlaySubscription } from "./google-play-api";
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
 * The app's POST and the purchase notification arrive together, so both may acknowledge one
 * purchase; when Google refuses the second, the purchase is already acknowledged. A resubscription
 * from the Play Store gets its owner's account id, which its later resubscriptions then carry.
 */
async function acknowledge({ purchase, referenceId }: ReconcileGooglePlaySubscriptionInput) {
  const { error } = await safeAsync(() =>
    acknowledgeGooglePlaySubscription({
      accountId: purchase.isResubscription ? referenceId : undefined,
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    }),
  );

  if (!error) {
    return;
  }

  const current = await getGooglePlaySubscription(purchase.purchaseToken);

  if (!current?.isAcknowledged) {
    throw error;
  }
}

/**
 * Acknowledges a granted purchase before saving it, so a saved notification never hides an
 * acknowledgement that failed: a retry reads the purchase again and acknowledges what's left.
 * A purchase token never moves between accounts.
 */
export async function reconcileGooglePlaySubscription(input: ReconcileGooglePlaySubscriptionInput) {
  const { purchase } = input;

  if (purchase.isActive && !purchase.isAcknowledged) {
    await acknowledge(input);
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
