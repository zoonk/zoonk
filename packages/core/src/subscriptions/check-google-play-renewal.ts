import { prisma } from "@zoonk/db";
import {
  getGooglePlayRenewalCheckAt,
  saveGooglePlayPurchase,
} from "./reconcile-google-play-subscription";

/**
 * The stored period end isn't the end of access (Google may have renewed the purchase, extended its
 * grace or still be retrying a payment), so Google is asked at each checkpoint. Returns the next
 * checkpoint, or null once Google has ended the purchase. Called by the API's renewal workflow.
 */
export async function checkGooglePlayRenewal(subscriptionId: string) {
  const now = new Date();
  const saved = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  const checkAt = getGooglePlayRenewalCheckAt(saved, now);

  if (!saved?.providerSubscriptionId || !checkAt || (saved.periodEnd && saved.periodEnd > now)) {
    return checkAt;
  }

  const current = await saveGooglePlayPurchase({
    eventId: null,
    findOwner: async (_purchase, seen) => seen?.referenceId ?? null,
    purchaseToken: saved.providerSubscriptionId,
  });

  return getGooglePlayRenewalCheckAt(current);
}
