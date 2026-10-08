import { getSkillArea } from "../planner/graph-areas";
import { type PlanState } from "../planner/plan-state";
import { getRecommendedTime } from "../time-advice-contract";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";

/** Less than this drop in what the plan covers isn't news a learner needs to answer. */
const NOTICE_DROP = 0.02;

const PERCENT = 100;

/**
 * Falling behind made the plan cover less of its goal by its date: what it covered when it was
 * last planned and now (of the exam, or of the goal: `measure`), and the daily time to offer: the
 * one that covers everything in depth again (`fullDepth`), or, when no time does, the most time a
 * day; null when the learner already gives that. The learner chooses: that time, less depth, or
 * where to focus (`canFocus`: the plan has more than one area to choose between).
 */
export type FallingBehind = {
  canFocus: boolean;
  coveredAfter: number;
  coveredBefore: number;
  /** The learner's daily time now, which covers `coveredAfter`. */
  currentMinutes: number;
  dailyMinutes: number | null;
  fullDepth: boolean;
  measure: "exam" | "goal";
};

/** A plan of several areas (not left out) can put its depth where it counts. */
function hasAreasToFocus({ graph, settings }: Pick<PlanState, "graph" | "settings">): boolean {
  const skipped = new Set(settings.skippedAreas);
  const areas = new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })));

  return [...areas].filter((area) => !skipped.has(area)).length > 1;
}

function toWholePercent(share: number): number {
  return Math.round(share * PERCENT);
}

/**
 * Whether settling the work earlier days left puts the date at risk: the plan covered all of its
 * goal and no longer does, or covers noticeably less than before. Null for plans without a date,
 * or when nothing changed that the learner needs to answer.
 */
export function getFallingBehind({
  computed,
  context,
}: {
  computed: Pick<ComputedPlan, "feasibility" | "state">;
  context: Pick<PlanContext, "plan">;
}): FallingBehind | null {
  const before = context.plan.coveredShare;
  const { feasibility } = computed;
  const dailyTime = computed.state.goal.dailyMinutes;

  if (before === null || !feasibility.deadline) {
    return null;
  }

  const after = feasibility.coveredShare;
  const lostWhole = toWholePercent(before) >= PERCENT && toWholePercent(after) < PERCENT;

  if (!lostWhole && before - after < NOTICE_DROP) {
    return null;
  }

  const dailyMinutes = getRecommendedTime(feasibility)?.dailyMinutes ?? null;

  return {
    canFocus: hasAreasToFocus(computed.state),
    coveredAfter: toWholePercent(after) / PERCENT,
    coveredBefore: toWholePercent(before) / PERCENT,
    currentMinutes: dailyTime,
    dailyMinutes: dailyMinutes !== null && dailyMinutes > dailyTime ? dailyMinutes : null,
    fullDepth: feasibility.recommendedMinutes !== null,
    measure: feasibility.measure,
  };
}
