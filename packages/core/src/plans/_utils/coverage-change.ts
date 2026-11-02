import { toPlanChangePayload } from "./plan-change-payload";
import { type ComputedPlan, type PlanChangeRecord } from "./replan";

/** For logs and admin only; the apps word the change from its kind and topics. */
const COVERAGE_NOTE = "Planned again, the plan teaches other topics by its date.";

export function getCoverageChange({
  computed,
  listeningPastBasics,
}: {
  computed: ComputedPlan;
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
