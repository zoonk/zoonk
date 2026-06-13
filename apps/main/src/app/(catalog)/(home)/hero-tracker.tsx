"use client";

import { trackHeroShown } from "@/lib/track-events";
import { useEffect } from "react";

/**
 * Sends a custom event only when the zero-progress hero actually renders,
 * which is narrower than using the home pageview as a proxy.
 */
export function HeroTracker() {
  useEffect(() => {
    trackHeroShown();
  }, []);

  return null;
}
