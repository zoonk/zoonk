"use client";

import { trackGoogleAdsSubscriptionConversion } from "@/lib/track-events";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

const STRIPE_CHECKOUT_PARAM = "stripe_checkout";
const HANDLED_SUBSCRIPTION_KEY_PREFIX = "zoonk-google-ads-subscription";
const CONFIRMATION_REFRESH_DELAY_MS = 3000;
const MAX_CONFIRMATION_REFRESH_COUNT = 5;

/**
 * Reports the Google Ads conversion only when Stripe returned to the
 * subscription page and the server-rendered billing state already shows an
 * active Stripe subscription.
 */
export function SubscriptionConversionTracker({
  activeSubscriptionId,
  stripeCheckoutCompleted,
}: {
  activeSubscriptionId: string | null;
  stripeCheckoutCompleted: boolean;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    if (!stripeCheckoutCompleted) {
      return;
    }

    if (!activeSubscriptionId) {
      refreshSubscriptionState(refresh);
      return;
    }

    if (hasHandledSubscriptionConversion(activeSubscriptionId)) {
      removeStripeCheckoutParamFromCurrentUrl();
      return;
    }

    trackGoogleAdsSubscriptionConversion();
    markSubscriptionConversionHandled(activeSubscriptionId);
    removeStripeCheckoutParamFromCurrentUrl();
  }, [activeSubscriptionId, refresh, stripeCheckoutCompleted]);

  return null;
}

/**
 * Refreshes a few times after Stripe redirects back because the webhook that
 * writes the subscription row can arrive a moment after the browser return.
 */
function refreshSubscriptionState(refresh: () => void) {
  const refreshCount = Number(globalThis.sessionStorage.getItem(getRefreshCountKey()) ?? "0");

  if (refreshCount >= MAX_CONFIRMATION_REFRESH_COUNT) {
    return;
  }

  globalThis.sessionStorage.setItem(getRefreshCountKey(), String(refreshCount + 1));
  globalThis.setTimeout(refresh, CONFIRMATION_REFRESH_DELAY_MS);
}

/**
 * Keeps one browser from reporting the same confirmed subscription twice when
 * the success page is refreshed or restored from history.
 */
function hasHandledSubscriptionConversion(subscriptionId: string) {
  return globalThis.sessionStorage.getItem(getHandledSubscriptionKey(subscriptionId)) === "true";
}

/**
 * Records the subscription id after the conversion event is queued.
 */
function markSubscriptionConversionHandled(subscriptionId: string) {
  globalThis.sessionStorage.setItem(getHandledSubscriptionKey(subscriptionId), "true");
  globalThis.sessionStorage.removeItem(getRefreshCountKey());
}

/**
 * Names the per-subscription marker so each new subscription can still report
 * its own conversion once.
 */
function getHandledSubscriptionKey(subscriptionId: string) {
  return `${HANDLED_SUBSCRIPTION_KEY_PREFIX}:${subscriptionId}`;
}

/**
 * Separates retry state from conversion state because a delayed webhook should
 * not mark the subscription as already reported.
 */
function getRefreshCountKey() {
  return `${HANDLED_SUBSCRIPTION_KEY_PREFIX}:refresh-count`;
}

/**
 * Removes only Stripe's checkout-return marker and preserves other query params
 * so the visible URL stops looking like a conversion state machine.
 */
function removeStripeCheckoutParamFromCurrentUrl() {
  const url = new URL(globalThis.location.href);
  url.searchParams.delete(STRIPE_CHECKOUT_PARAM);
  globalThis.history.replaceState(globalThis.history.state, "", url);
}
