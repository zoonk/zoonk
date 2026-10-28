import { z } from "zod";
import { GOOGLE_PLAY_PACKAGE_NAME } from "./google-play-api";
import { verifyGooglePlayPush } from "./google-play-push";
import {
  findGooglePlayLineOwner,
  getGooglePlayRenewalCheck,
  saveGooglePlayPurchase,
} from "./reconcile-google-play-subscription";
import { findNotificationOwner } from "./reconcile-store-subscription";

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

/**
 * Reconciles Real-time Developer Notifications from the Pub/Sub push subscription so renewals,
 * holds, refunds and revocations reach every client even when the Android app is closed. A
 * notification only says which purchase changed: its state comes from Google's API. A first
 * delivery saves the purchase only for its line's owner (`findGooglePlayLineOwner`) while that
 * user exists; a known purchase keeps its owner.
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

  const subscription = await saveGooglePlayPurchase({
    eventId: message.messageId,
    findOwner: async (purchase, seen) =>
      seen?.referenceId ??
      findNotificationOwner({
        accountId: await findGooglePlayLineOwner(purchase),
        existingReferenceId: null,
      }),
    purchaseToken,
  });

  return subscription
    ? { renewalCheck: getGooglePlayRenewalCheck(subscription), subscription }
    : null;
}
