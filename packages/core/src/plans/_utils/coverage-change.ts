import { toPlanChangePayload } from "./plan-change-payload";
import { type ComputedPlan, type PlanChangeRecord } from "./replan";

/** A plain note for logs and admin; the apps say the change from its kind and topics. */
const COVERAGE_NOTE = "Planned again, the plan teaches other topics by its date.";

/** Placement's answers changed which topics fit; its notice names what moved. */
export function getCoverageChange({
  computed,
  listeningPastBasics,
}: {
  computed: ComputedPlan;
  /** The listening areas those answers started past their basics (`PlanEffect`'s). */
  listeningPastBasics?: string[];
}): PlanChangeRecord | null {
  const { effect } = computed;

  if (!effect.topicsAdded && !effect.topicsLeftOut) {
    return null;
  }

  return {
    kind: "coverageChanged",
    payload: toPlanChangePayload({
      effect: {
        ...effect,
        fromPlacement: true,
        ...(listeningPastBasics && { listeningPastBasics }),
      },
      source: "system",
    }),
    reason: COVERAGE_NOTE,
    status: "applied",
  };
}
