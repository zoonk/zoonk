"use client";

import { usePathname } from "@/i18n/navigation";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { type DayEntry, findDayTap } from "./day-entry";
import { getDayEntry, subscribeToDayEntry } from "./day-entry-registry";

export function useDayEntry(): DayEntry | null {
  return useSyncExternalStore(subscribeToDayEntry, getDayEntry, () => null);
}

/** Read from the router's own state, so it's right in the very render that commits a navigation. */
function useEntryScope() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const summary = useLearnerSummary();

  return {
    generation: getLearnerGeneration(),
    href: search ? `${pathname}?${search}` : pathname,
    userId: summary.status === "ready" ? summary.summary.identity.userId : null,
  };
}

export function useDayTap<Step extends { position: number; status: string }>(day: {
  blocks: readonly Step[];
  goalId: string;
  localDate: Date;
}) {
  const entry = useDayEntry();
  const scope = useEntryScope();
  return findDayTap({ ...scope, day, entry });
}
