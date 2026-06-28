"use client";

import { trackSubscriptionGateShown } from "@/lib/track-events";
import { useEffect } from "react";

/**
 * Records the moment the upgrade CTA is visible. The app only renders this CTA
 * for blocked subscription states, so the effect represents a real paywall
 * impression rather than a subscribed visit.
 */
export function SubscriptionGateTracker() {
  useEffect(() => {
    trackSubscriptionGateShown();
  }, []);

  return null;
}
