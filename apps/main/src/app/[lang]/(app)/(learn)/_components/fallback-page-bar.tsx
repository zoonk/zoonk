"use client";

import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { useIsTabRoot } from "./learn-tab-navigation";

/**
 * The bar of a page that couldn't show (it failed, or isn't there): a tab keeps the app bar, and a
 * page opened from the Plan keeps its way back.
 */
export function FallbackPageBar() {
  return useIsTabRoot() ? null : <JourneyPageBar />;
}
