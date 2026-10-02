"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useShortDays, useShortFocusName } from "./use-short-plan";

type NamedPhase = Pick<PlanPhaseView, "index" | "kind" | "name" | "short">;

/**
 * Exam phases come without a name, so the app names them by what they're for; a plan for a test
 * days away names each by its days' focus.
 */
export function usePhaseName() {
  const t = useExtracted();
  const focusName = useShortFocusName();

  return (phase: NamedPhase): string => {
    if (phase.name) {
      return phase.name;
    }

    if (phase.short) {
      return focusName(phase.short.focus);
    }

    switch (phase.kind) {
      case "foundations":
        return t("Foundations");
      case "gaps":
        return t("Fill the gaps");
      case "practice":
        return t("Practice");
      case "finalStretch":
        return t("Final stretch");
      case "learn":
        return t("Phase {number, number}", { number: phase.index + 1 });
      default:
        return t("Phase {number, number}", { number: phase.index + 1 });
    }
  };
}

/** "Phase 2: Fill the gaps", or "Day 1 of 3: Exam map and gaps" in a plan for a test days away. */
export function usePhaseTitle() {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const shortDays = useShortDays();

  return (phase: NamedPhase): string => {
    const name = phaseName(phase);
    const days = shortDays(phase.short);

    return days
      ? t("{days}: {name}", { days, name })
      : t("Phase {number, number}: {name}", { name, number: phase.index + 1 });
  };
}
