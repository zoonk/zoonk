import { auth } from "@zoonk/auth";
import { findActiveSubscription } from "@zoonk/auth/subscription";

/**
 * Better Auth represents a signed-out subscription lookup as an API error even
 * though the product-level answer is simply “no active subscription.” Matching
 * its named status keeps that expected case distinct from Stripe failures,
 * including Stripe authentication errors that also use HTTP status 401.
 */
function isSignedOutSubscriptionLookup(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === "UNAUTHORIZED"
  );
}

export async function getActiveSubscription(headers: Headers) {
  try {
    const subscriptions = await auth.api.listActiveSubscriptions({ headers });
    return findActiveSubscription(subscriptions);
  } catch (error) {
    if (isSignedOutSubscriptionLookup(error)) {
      return null;
    }

    throw error;
  }
}

export async function hasActiveSubscription(headers: Headers) {
  const subscription = await getActiveSubscription(headers);
  return Boolean(subscription);
}
