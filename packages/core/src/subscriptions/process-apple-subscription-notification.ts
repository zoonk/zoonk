import { prisma } from "@zoonk/db";
import { getAppleSubscriptionProduct } from "./apple-products";
import { getAppleSubscriptionFromNotification } from "./apple-store";
import { findAppleSubscription, reconcileAppleSubscription } from "./reconcile-apple-subscription";

/**
 * Existing chains keep their established owner. First delivery may create a row only for the
 * signed appAccountToken of a user who still exists.
 */
async function getNotificationReferenceId({
  accountToken,
  existingReferenceId,
}: {
  accountToken: string | null;
  existingReferenceId: string | null;
}) {
  if (existingReferenceId) {
    return existingReferenceId;
  }

  if (!accountToken) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: accountToken } });
  return user?.id ?? null;
}

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

  const existing = await findAppleSubscription(verifiedSubscription.originalTransactionId);

  const referenceId = await getNotificationReferenceId({
    accountToken: verifiedSubscription.accountToken,
    existingReferenceId: existing?.referenceId ?? null,
  });

  if (!referenceId) {
    return null;
  }

  return reconcileAppleSubscription({ product, referenceId, verifiedSubscription });
}
