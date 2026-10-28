import { prisma } from "@zoonk/db";
import {
  getGooglePlayRenewalCheckAt,
  saveGooglePlayPurchase,
} from "./reconcile-google-play-subscription";

/**
 * Runs at a saved purchase's renewal checkpoint (from the API's renewal workflow): Plus doesn't end
 * when the stored period does, since Google may have renewed it, extended its grace or still be
 * retrying the payment (silent grace), so Google is read again and its answer saved. Returns when
 * to check next, or null once Google has ended the purchase. Not a learner capability: the
 * workflow passes the id of a subscription a save scheduled.
 */
export async function checkGooglePlayRenewal(subscriptionId: string) {
  const now = new Date();
  const saved = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  const checkAt = getGooglePlayRenewalCheckAt(saved, now);

  /** Ended, or renewed since this check was scheduled: nothing to ask Google yet. */
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
