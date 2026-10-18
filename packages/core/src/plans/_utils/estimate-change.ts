import { SMALL_CHANGE_LESSONS } from "../planner/plan-change-thresholds";
import { toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, type PlanChangeRecord } from "./replan";
import { getSeenEffect } from "./seen-effect";

/**
 * One notice per refresh when the net lesson count the learner saw changes past the threshold, when
 * the run leaves out a lesson the learner saw (named, whatever the count: a swap kept the count and
 * said nothing), or when the run moves a phase end the learner saw: a challenge comes the first
 * study day after the lessons it tests, so lessons that slip past its day move it, and the notice
 * names the new end (`effect.phaseEnds`). A slower session moved Basics' end from Oct 7 without a
 * word.
 */
export function getEstimateChange({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): PlanChangeRecord | null {
  // The first layout has no lesson count the learner has seen to compare.
  if (!context.phases.some((phase) => phase.startDate !== null)) {
    return null;
  }

  const seen = getSeenEffect({ computed, shown: context.items });

  const movesEnds = (computed.effect.phaseEnds?.length ?? 0) > 0;
  const leavesOut = (seen.lessonsLeftOut?.length ?? 0) > 0;

  if (
    !movesEnds &&
    !leavesOut &&
    Math.abs(seen.lessonsAdded - seen.lessonsRemoved) <= SMALL_CHANGE_LESSONS
  ) {
    return null;
  }

  // Whether additions are estimated comes from the same seen count, not the stored item count.
  const { lessonsAddedEstimated: _planned, ...effect } = computed.effect;

  return {
    kind: "estimateUpdated",
    payload: toPlanChangePayload({ effect: { ...effect, ...seen }, source: "system" }),
    reason: "The plan's lesson estimates changed.",
    status: "applied",
  };
}
