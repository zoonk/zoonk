import { SMALL_CHANGE_LESSONS } from "../planner/plan-change-thresholds";
import { toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, type PlanChangeRecord } from "./replan";

export function getEstimateChange({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): PlanChangeRecord | null {
  if (!context.phases.some((phase) => phase.startDate !== null)) {
    return null;
  }

  const { effect } = computed;
  const movesEnds = (effect.phaseEnds?.length ?? 0) > 0;
  const leavesOut = (effect.lessonsLeftOut?.length ?? 0) > 0;

  if (
    !movesEnds &&
    !leavesOut &&
    Math.abs(effect.lessonsAdded - effect.lessonsRemoved) <= SMALL_CHANGE_LESSONS
  ) {
    return null;
  }

  return {
    kind: "estimateUpdated",
    payload: toPlanChangePayload({ effect, source: "system" }),
    reason: "The plan's lesson estimates changed.",
    status: "applied",
  };
}
