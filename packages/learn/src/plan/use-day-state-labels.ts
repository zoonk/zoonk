"use client";

import { type PlanDayView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";

/**
 * What each day state of the week's plan says to screen readers, since both modes draw it as an
 * icon or a dot. Upcoming days need no word.
 */
export function useDayStateLabels(): Record<PlanDayView["state"], string | null> {
  const t = useExtracted();

  return {
    done: t("Done"),
    missed: t("Not done"),
    rest: t("Rest"),
    today: t("Today"),
    upcoming: null,
  };
}
