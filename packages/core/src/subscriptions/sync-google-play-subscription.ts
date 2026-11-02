import { getSession } from "../users/get-session";
import { GooglePlayError } from "./google-play-error";
import {
  type ScheduleRenewalCheck,
  findGooglePlayLineOwner,
  saveGooglePlayPurchase,
} from "./reconcile-google-play-subscription";
import { isActiveStoreSubscription } from "./reconcile-store-subscription";

/**
 * Derives ownership from the authenticated session. A purchase line that already belongs to an
 * account (the id the app set at purchase, `obfuscatedAccountId`, or the stored owner of the
 * purchase it replaced) must be the learner's; one made in the Play Store that names no account,
 * such as with a promo code, becomes theirs.
 */
export async function syncCurrentUserGooglePlaySubscription({
  purchaseToken,
  scheduleRenewalCheck,
}: {
  purchaseToken: string;
  scheduleRenewalCheck: ScheduleRenewalCheck;
}) {
  const session = await getSession();

  if (!session) {
    throw new GooglePlayError("unauthorized");
  }

  const userId = session.user.id.toLowerCase();

  const subscription = await saveGooglePlayPurchase({
    eventId: null,
    findOwner: async (purchase) => {
      const owner = await findGooglePlayLineOwner(purchase);

      if (owner && owner !== userId) {
        throw new GooglePlayError("accountMismatch");
      }

      return session.user.id;
    },
    purchaseToken,
    scheduleRenewalCheck,
  });

  return { isActive: subscription ? isActiveStoreSubscription(subscription) : false };
}
