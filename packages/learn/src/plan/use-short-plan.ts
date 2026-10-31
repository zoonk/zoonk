"use client";

import { type ShortExamFocus, type ShortPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";

export function useShortFocusName() {
  const t = useExtracted();

  return (focus: ShortExamFocus, { mocksRequirePlus = false } = {}): string => {
    switch (focus) {
      case "mapAndGaps":
        return t("Exam map and gaps");
      case "practice":
        return t("Practice");
      case "mockAndPractice":
        return mocksRequirePlus ? t("Full review and practice") : t("Mock and practice");
      case "mockAndReview":
        return mocksRequirePlus ? t("Full review") : t("Short mock and review");
      case "lightReview":
        return t("Light review");
      default:
        return t("Practice");
    }
  };
}

export function useShortDayRange() {
  const t = useExtracted();

  return ({ days, first, last }: { days: number; first: number; last: number }): string =>
    first === last
      ? t("Day {day, number} of {days, number}", { day: first, days })
      : t("Days {first, number} to {last, number} of {days, number}", { days, first, last });
}

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
