import "server-only";
import { listPhaseEndMoves } from "../planner/phase-dates-move";
import { type PlanEffect } from "../planner/plan-effect";
import { loadLeftWork } from "./left-work";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, computePlan } from "./replan";
import { withSeenTopics } from "./seen-effect";

/**
 * What resuming a paused goal does to its plan. Paused days aren't missed days: when the pause left
 * lessons behind (on days now past, or given by the last study day, see `loadLeftWork`), the plan
 * is planned again from today, as a change the learner makes, so they come first and the rest
 * moves on, and the learner sees that, with the phase ends it moves, before they resume. The
 * resume settles the day with them (`carriedItemIds`), so they aren't settled again as missed days
 * and the learner isn't behind for a break. A pause that left nothing behind (resumed the same
 * day, or over rest days only) keeps the plan as the learner saw it: planned again a minute after
 * a pause, Marcos's second phase lost three lessons and five days. Null when the plan stays.
 */
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
    effect: {
      ...withSeenTopics({ computed, shown: context.items }),
      ...(phaseEnds.length > 0 && { phaseEnds }),
    },
  };
}
