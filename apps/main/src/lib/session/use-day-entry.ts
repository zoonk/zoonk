"use client";

import { usePathname } from "@/i18n/navigation";
import { getLearnerId } from "@/lib/learner/learner-store";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { type DayEntry, findDayTap } from "./day-entry";
import { getDayEntry, markDayEntryShown, subscribeToDayEntry } from "./day-entry-registry";

export function useDayEntry(): DayEntry | null {
  return useSyncExternalStore(subscribeToDayEntry, getDayEntry, () => null);
}

/** Read from the router's own state, so it's right in the very render that commits a navigation. */
function useEntryScope() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  // Subscribed, so it draws again when who holds the session changes.
  useLearnerSummary();

  return { href: search ? `${pathname}?${search}` : pathname, learner: getLearnerId() };
}

export function useDayTap<Step extends { position: number; status: string }>(day: {
  blocks: readonly Step[];
  goalId: string;
  localDate: Date;
}) {
  const entry = useDayEntry();
  const scope = useEntryScope();
  const tapped = findDayTap({ ...scope, day, entry });
  const shownId = tapped && entry ? entry.id : null;

  useEffect(() => {
    if (shownId !== null) {
      markDayEntryShown(shownId);
    }
  }, [shownId]);

  return tapped;
}
