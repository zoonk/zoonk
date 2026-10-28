import { getSession } from "../users/get-session";
import { getGooglePlaySubscription } from "./google-play-api";
import { GooglePlayError } from "./google-play-error";
import { getGooglePlaySubscriptionProduct } from "./google-play-products";
import { reconcileGooglePlaySubscription } from "./reconcile-google-play-subscription";
import { isActiveStoreSubscription } from "./reconcile-store-subscription";

/**
 * Derives ownership from the authenticated session and requires the account id the app set at
 * purchase (`obfuscatedAccountId`) to match before granting cross-platform access.
 */
export async function syncCurrentUserGooglePlaySubscription({
  purchaseToken,
}: {
  purchaseToken: string;
}) {
  const session = await getSession();

  if (!session) {
    throw new GooglePlayError("unauthorized");
  }

  const purchase = await getGooglePlaySubscription(purchaseToken);

  if (!purchase) {
    return { isActive: false };
  }

  if (purchase.accountId !== session.user.id.toLowerCase()) {
    throw new GooglePlayError("accountMismatch");
  }

  const product = getGooglePlaySubscriptionProduct(purchase);

  if (!product) {
    throw new GooglePlayError("invalidProduct");
  }

  const subscription = await reconcileGooglePlaySubscription({
    eventId: null,
    product,
    purchase,
    referenceId: session.user.id,
  });

  return { isActive: isActiveStoreSubscription(subscription) };
}
