"use client";

import { trackEvent } from "@zoonk/core/analytics/client";
import { useEffect } from "react";

/** Records that someone opened a plan's link, so the page itself stays server-rendered. */
export function PlanLinkTracker({ planId }: { planId: string }) {
  useEffect(() => {
    trackEvent({ name: "Plan Link Opened", properties: { plan_id: planId } });
  }, [planId]);

  return null;
}
