import { getAppleSubscriptionProduct } from "./apple-products";
import { getAppleSubscriptionFromNotification } from "./apple-store";
import { reconcileAppleSubscription } from "./reconcile-apple-subscription";
import { findNotificationOwner, findStoreSubscription } from "./reconcile-store-subscription";

/**
 * Reconciles signed server notifications so renewals, refunds, grace periods, and revocations
 * reach web clients even when the Apple app is closed.
 */
export async function processAppleSubscriptionNotification({
  signedPayload,
}: {
  signedPayload: string;
}) {
  const verifiedSubscription = await getAppleSubscriptionFromNotification({ signedPayload });

  if (!verifiedSubscription) {
    return null;
  }

  const product = getAppleSubscriptionProduct(verifiedSubscription.productId);

  if (!product) {
    return null;
  }

  const existing = await findStoreSubscription({
    provider: "apple",
    providerSubscriptionId: verifiedSubscription.originalTransactionId,
  });

  const referenceId = await findNotificationOwner({
    accountId: verifiedSubscription.accountToken,
    existingReferenceId: existing?.referenceId ?? null,
  });

  if (!referenceId) {
    return null;
  }

  return reconcileAppleSubscription({ product, referenceId, verifiedSubscription });
}
