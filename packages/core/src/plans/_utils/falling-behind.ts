import { getSkillArea } from "../planner/graph-areas";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";

/** Less than this drop in what the plan covers isn't news a learner needs to answer. */
const NOTICE_DROP = 0.02;

const PERCENT = 100;

/**
 * Falling behind made the plan cover less of its goal by its date: what it covered when it was
 * last planned and now (of the exam, or of the goal: `measure`), at the learner's daily time now.
 * The learner chooses: more time a day or a later date (the plan's editor works out what covers
 * everything when they ask), less depth, or where to focus (`canFocus`: the plan has more than one
 * area to choose between). Only facts of the plan itself: no other daily time or date is planned
 * to say it.
 */
export type FallingBehind = {
  canFocus: boolean;
  coveredAfter: number;
  coveredBefore: number;
  /** The learner's daily time now, which covers `coveredAfter`. */
  currentMinutes: number;
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
  context: { plan: Pick<PlanContext["plan"], "coveredShare"> };
}): FallingBehind | null {
  const before = context.plan.coveredShare;
  const { feasibility } = computed;

  if (before === null || !feasibility.deadline) {
    return null;
  }

  const after = feasibility.coveredShare;
  const lostWhole = toWholePercent(before) >= PERCENT && toWholePercent(after) < PERCENT;

  if (!lostWhole && before - after < NOTICE_DROP) {
    return null;
  }

  return {
    canFocus: hasAreasToFocus(computed.state),
    coveredAfter: toWholePercent(after) / PERCENT,
    coveredBefore: toWholePercent(before) / PERCENT,
    currentMinutes: computed.state.goal.dailyMinutes,
    measure: feasibility.measure,
  };
}
