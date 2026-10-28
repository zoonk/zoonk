import { getAppleSubscriptionProduct } from "./apple-products";
import { getAppleSubscriptionFromNotification } from "./apple-store";
import { reconcileAppleSubscription } from "./reconcile-apple-subscription";
import { findNotificationOwner, findStoreSubscription } from "./reconcile-store-subscription";

/** Verifies server notifications and reconciles cross-platform entitlement without requiring the Apple app open. */
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
