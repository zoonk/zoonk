import "server-only";
import { listPhaseEndMoves } from "../planner/phase-dates-move";
import { type PlanEffect } from "../planner/plan-effect";
import { loadLeftWork } from "./left-work";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, computePlan } from "./replan";

export async function computeResumedPlan(
  context: PlanContext,
): Promise<{ carriedItemIds: string[]; computed: ComputedPlan; effect: PlanEffect } | null> {
  const left = await loadLeftWork(context);

  if (left.length === 0) {
    return null;
  }

  const computed = await computePlan({ context, mode: "forced" });
  const phaseEnds = listPhaseEndMoves({ after: computed.built.phases, shown: context.phases });

  return {
    carriedItemIds: left.map((item) => item.id),
    computed,
    effect: { ...computed.effect, ...(phaseEnds.length > 0 && { phaseEnds }) },
  };
}
