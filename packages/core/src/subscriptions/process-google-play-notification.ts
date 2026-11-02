import { GOOGLE_PLAY_PACKAGE_NAME } from "@zoonk/auth/google-service-account";
import { z } from "zod";
import { verifyGooglePlayPush } from "./google-play-push";
import {
  type ScheduleRenewalCheck,
  findGooglePlayLineOwner,
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

/** Test and one-time product notifications change no entitlement. */
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
 * A notification only says which purchase changed, so its state is read from Google. A known
 * purchase keeps its owner; a new one is saved only for its line's owner while that user exists.
 */
export async function processGooglePlayNotification({
  audience,
  authorization,
  message,
  scheduleRenewalCheck,
}: {
  audience: string;
  authorization: string | null;
  message: { data: string; messageId: string };
  scheduleRenewalCheck: ScheduleRenewalCheck;
}) {
  await verifyGooglePlayPush({ audience, authorization });

  const purchaseToken = getNotifiedPurchaseToken(message.data);

  if (!purchaseToken) {
    return null;
  }

  return saveGooglePlayPurchase({
    eventId: message.messageId,
    findOwner: async (purchase, seen) =>
      seen?.referenceId ??
      findNotificationOwner({
        accountId: await findGooglePlayLineOwner(purchase),
        existingReferenceId: null,
      }),
    purchaseToken,
    scheduleRenewalCheck,
  });
}
