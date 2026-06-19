"use client";

import { trackStartContent } from "@/lib/track-events";
import { useEffect } from "react";

/**
 * Records the start goal picker impression from the browser while keeping the
 * translated `StartContent` component server-rendered.
 */
export function StartContentTracker() {
  useEffect(() => {
    trackStartContent();
  }, []);

  return null;
}
