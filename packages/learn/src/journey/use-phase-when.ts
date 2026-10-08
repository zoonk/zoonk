"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "../plan/plan-context";
import { useShortDays } from "../plan/use-short-plan";

/**
 * When a phase ends: its days in a plan for a test days away, otherwise its last day. Phases the
 * Library's graph sizes (learn plans) are estimates, so the ones ahead say the month. A done phase
 * says nothing (its check says it), and neither does the last one, whose end the finish says.
 */
export function usePhaseWhen() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const shortDays = useShortDays();
  const { plan } = usePlanScreen();
  const lastIndex = plan.phases.length - 1;

  return function phaseWhen(phase: PlanPhaseView): string | null {
    const days = shortDays(phase.short);

    if (days) {
      return days;
    }

    if (phase.state === "done") {
      return null;
    }

    // The last phase ends where the path does: the finish right after it says when.
    if (!phase.endDate || phase.index === lastIndex) {
      return null;
    }

    const isEstimate = phase.kind === "learn" && phase.state === "upcoming";

    return t("Until {date}", { date: formatDate(phase.endDate, isEstimate ? "month" : "day") });
  };
}
