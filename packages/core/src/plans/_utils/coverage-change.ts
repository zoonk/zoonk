import { toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, type PlanChangeRecord } from "./replan";
import { getSeenEffect } from "./seen-effect";

/** A plain note for logs and admin; the apps say the change from its kind and topics. */
const COVERAGE_NOTE = "Planned again, the plan teaches other topics by its date.";

/** Placement's answers changed which topics fit; its notice names what moved. */
export function getCoverageChange({
  computed,
  context,
  fromPlacement = false,
  listeningPastBasics = [],
}: {
  computed: ComputedPlan;
  context: PlanContext;
  /** Placement's answers planned it again (see `PlanEffect.fromPlacement`). */
  fromPlacement?: boolean;
  /** The listening areas those answers started past their basics (`PlanEffect`'s). */
  listeningPastBasics?: string[];
}): PlanChangeRecord | null {
  const seen = getSeenEffect({ computed, shown: context.items });

  if (!seen.topicsAdded && !seen.topicsLeftOut) {
    return null;
  }

  // The lessons the learner sees added come from `seen`, so whether they're an estimate does too.
  const { lessonsAddedEstimated: _planned, ...effect } = computed.effect;

  return {
    kind: "coverageChanged",
    payload: toPlanChangePayload({
      effect: {
        ...effect,
        ...seen,
        ...(fromPlacement ? { fromPlacement } : {}),
        ...(listeningPastBasics.length > 0 ? { listeningPastBasics } : {}),
      },
      source: "system",
    }),
    reason: COVERAGE_NOTE,
    status: "applied",
  };
}
