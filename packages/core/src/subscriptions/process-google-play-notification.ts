import { prisma } from "@zoonk/db";
import { z } from "zod";
import { GOOGLE_PLAY_PACKAGE_NAME, getGooglePlaySubscription } from "./google-play-api";
import { getGooglePlaySubscriptionProduct } from "./google-play-products";
import { verifyGooglePlayPush } from "./google-play-push";
import { reconcileGooglePlaySubscription } from "./reconcile-google-play-subscription";
import { findStoreSubscription } from "./reconcile-store-subscription";

const PRODUCT_TYPE_SUBSCRIPTION = 1;

const developerNotificationSchema = z.object({
  packageName: z.string(),
  subscriptionNotification: z.object({ purchaseToken: z.string().min(1) }).optional(),
  voidedPurchaseNotification: z
    .object({ productType: z.number(), purchaseToken: z.string().min(1) })
    .optional(),
});

/**
 * The purchase token a notification is about, when it's one of this app's subscriptions: a state
 * change or a refund. Test and one-time product notifications change no entitlement.
 */
function getNotifiedPurchaseToken(data: string) {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    const notification = developerNotificationSchema.parse(decoded);

    if (notification.packageName !== GOOGLE_PLAY_PACKAGE_NAME) {
      return null;
    }

    const voided = notification.voidedPurchaseNotification;

    if (voided?.productType === PRODUCT_TYPE_SUBSCRIPTION) {
      return voided.purchaseToken;
    }

    return notification.subscriptionNotification?.purchaseToken ?? null;
  } catch {
    return null;
  }
}

/** A known chain keeps its owner; a first delivery may create a row only for an existing user. */
async function getReferenceId({
  accountId,
  existingReferenceId,
}: {
  accountId: string | null;
  existingReferenceId: string | null;
}) {
  if (existingReferenceId) {
    return existingReferenceId;
  }

  if (!accountId) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: accountId } });
  return user?.id ?? null;
}

/**
 * Reconciles Real-time Developer Notifications from the Pub/Sub push subscription so renewals,
 * holds, refunds and revocations reach every client even when the Android app is closed. A
 * notification only says which purchase changed: its state comes from Google's API.
 */
export async function processGooglePlayNotification({
  audience,
  authorization,
  message,
}: {
  audience: string;
  authorization: string | null;
  message: { data: string; messageId: string };
}) {
  await verifyGooglePlayPush({ audience, authorization });

  const purchaseToken = getNotifiedPurchaseToken(message.data);

  if (!purchaseToken) {
    return null;
  }

  const existing = await findStoreSubscription({
    provider: "google",
    providerSubscriptionId: purchaseToken,
  });

  /** Pub/Sub delivers at least once: a message already saved needs no second read from Google. */
  if (existing?.providerEventId === message.messageId) {
    return existing;
  }

  const purchase = await getGooglePlaySubscription(purchaseToken);
  const product = purchase && getGooglePlaySubscriptionProduct(purchase);

  if (!purchase || !product) {
    return null;
  }

  const referenceId = await getReferenceId({
    accountId: purchase.accountId,
    existingReferenceId: existing?.referenceId ?? null,
  });

  if (!referenceId) {
    return null;
  }

  return reconcileGooglePlaySubscription({
    eventId: message.messageId,
    product,
    purchase,
    referenceId,
  });
}
