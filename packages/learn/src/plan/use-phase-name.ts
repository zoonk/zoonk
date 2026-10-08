"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useShortFocusName } from "./use-short-plan";

type NamedPhase = Pick<PlanPhaseView, "index" | "kind" | "name" | "short">;

/**
 * Exam phases come without a name, so the app names them by what they're for; a plan for a test
 * days away names each by its days' focus. The names are site messages (`planPhases`), so a shared
 * plan's public page names them the same way.
 */
export function usePhaseName() {
  const t = useExtracted("planPhases");
  const focusName = useShortFocusName();

  return (phase: NamedPhase, { mocksRequirePlus = false } = {}): string => {
    if (phase.name) {
      return phase.name;
    }

    if (phase.short) {
      return focusName(phase.short.focus, { mocksRequirePlus });
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
