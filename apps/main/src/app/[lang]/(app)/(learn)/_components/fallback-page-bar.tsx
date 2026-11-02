"use client";

import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { useIsTabRoot } from "./learn-tab-navigation";

export function FallbackPageBar() {
  return useIsTabRoot() ? null : <JourneyPageBar />;
}
