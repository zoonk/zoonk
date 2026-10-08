"use client";

import { type ShortExamFocus, type ShortPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";

/**
 * What a day of a plan for a test days away is for. Without mocks in the learner's plan (they come
 * with Plus), the short mock's day is a full review of every topic instead.
 */
export function useShortFocusName() {
  const t = useExtracted();

  return (focus: ShortExamFocus, { mocksRequirePlus = false } = {}): string => {
    switch (focus) {
      case "mapAndGaps":
        return t("Exam map and gaps");
      case "practice":
        return t("Practice");
      case "mockAndReview":
        return mocksRequirePlus ? t("Full review") : t("Short mock and review");
      case "lightReview":
        return t("Light review");
      default:
        return t("Practice");
    }
  };
}

/** "Day 1 of 3" or "Days 1 to 4 of 7": which days of a plan for a test days away. */
export function useShortDayRange() {
  const t = useExtracted();

  return ({ days, first, last }: { days: number; first: number; last: number }): string =>
    first === last
      ? t("Day {day, number} of {days, number}", { day: first, days })
      : t("Days {first, number} to {last, number} of {days, number}", { days, first, last });
}

/** A phase's days in the plan on screen, or null when the plan isn't for a test days away. */
export function useShortDays() {
  const { plan } = usePlanScreen();
  const dayRange = useShortDayRange();

  return function shortDays(
    short: Pick<ShortPhaseView, "firstDay" | "lastDay"> | null,
  ): string | null {
    return short && plan.shortPlan
      ? dayRange({ days: plan.shortPlan.days, first: short.firstDay, last: short.lastDay })
      : null;
  };
}
