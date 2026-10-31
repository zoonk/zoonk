"use client";

import { useEffect } from "react";

const STRIPE_CHECKOUT_PARAM = "stripe_checkout";

/** The conversion is sent from the webhook, so a learner who never comes back still counts. */
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

function removeStripeCheckoutParamFromCurrentUrl() {
  const url = new URL(globalThis.location.href);
  url.searchParams.delete(STRIPE_CHECKOUT_PARAM);
  globalThis.history.replaceState(globalThis.history.state, "", url);
}
