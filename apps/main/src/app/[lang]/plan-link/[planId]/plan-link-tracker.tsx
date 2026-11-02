"use client";

import { trackEvent } from "@zoonk/core/analytics/client";
import { useEffect } from "react";

export function PlanLinkTracker({ planId }: { planId: string }) {
  useEffect(() => {
    trackEvent({ name: "Plan Link Opened", properties: { plan_id: planId } });
  }, [planId]);

  return null;
}
