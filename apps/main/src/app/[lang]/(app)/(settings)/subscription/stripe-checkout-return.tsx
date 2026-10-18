"use client";

import { useEffect } from "react";

const STRIPE_CHECKOUT_PARAM = "stripe_checkout";

/**
 * Once the subscription Stripe's return waited for shows, the URL stops looking like a checkout
 * state. The conversion itself is sent from the webhook, so a learner who never comes back still
 * counts. Until then, `StripeCheckoutConfirming` shows instead of the plan.
 */
export function StripeCheckoutReturn({
  stripeCheckoutCompleted,
}: {
  stripeCheckoutCompleted: boolean;
}) {
  useEffect(() => {
    if (stripeCheckoutCompleted) {
      removeStripeCheckoutParamFromCurrentUrl();
    }
  }, [stripeCheckoutCompleted]);

  return null;
}

/**
 * Removes only Stripe's checkout-return marker and preserves other query params
 * so the visible URL stops looking like a checkout state.
 */
function removeStripeCheckoutParamFromCurrentUrl() {
  const url = new URL(globalThis.location.href);
  url.searchParams.delete(STRIPE_CHECKOUT_PARAM);
  globalThis.history.replaceState(globalThis.history.state, "", url);
}
