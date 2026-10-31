import { prisma } from "@zoonk/db";
import {
  getGooglePlayRenewalCheckAt,
  saveGooglePlayPurchase,
} from "./reconcile-google-play-subscription";

function findGooglePlaySubscription(subscriptionId: string) {
  return prisma.subscription.findFirst({ where: { id: subscriptionId, provider: "google" } });
}

/** When the API's renewal workflow should next check this row, or null once it needs no check. */
export async function findGooglePlayRenewalCheckAt(subscriptionId: string) {
  return getGooglePlayRenewalCheckAt(await findGooglePlaySubscription(subscriptionId));
}

/**
 * The stored period end isn't the end of access (Google may have renewed the purchase, extended its
 * grace or still be retrying a payment), so Google is asked once the period is over, and while an
 * acknowledgement is pending, and its answer saved.
 */
export async function checkGooglePlayRenewal(subscriptionId: string) {
  const now = new Date();
  const saved = await findGooglePlaySubscription(subscriptionId);

  if (!saved?.providerSubscriptionId || !getGooglePlayRenewalCheckAt(saved, now)) {
    return;
  }

  if (saved.providerAcknowledged && saved.periodEnd && saved.periodEnd > now) {
    return;
  }

  await saveGooglePlayPurchase({
    eventId: null,
    findOwner: async (_purchase, seen) => seen?.referenceId ?? null,
    purchaseToken: saved.providerSubscriptionId,
  });
}
