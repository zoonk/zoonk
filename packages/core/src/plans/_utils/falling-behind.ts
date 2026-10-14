import { getSkillArea } from "../planner/graph-areas";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanState } from "../planner/plan-state";
import { getMoreTime, getRecommendedTime } from "../time-advice-contract";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";

/** Less than this drop in what the plan covers isn't news a learner needs to answer. */
const NOTICE_DROP = 0.02;

const PERCENT = 100;

/**
 * Falling behind made the plan cover less of its goal by its date: what it covered when it was
 * last planned and now (of the exam, or of the goal: `measure`), and the daily time to offer: the
 * one that covers everything in depth again (`fullDepth`), or, when no time does, the most time a
 * day, with the share it covers (`maximumShare`); null when the learner already gives that. The
 * learner chooses: that time, less depth, or where to focus (`canFocus`: the plan has more than one
 * area to choose between); when no time covers a goal that isn't an exam, moving its date to the
 * day their time covers it all by (`fittingDate`) instead of more time.
 */
export type FallingBehind = {
  canFocus: boolean;
  coveredAfter: number;
  coveredBefore: number;
  /** The learner's daily time now, which covers `coveredAfter`. */
  currentMinutes: number;
  dailyMinutes: number | null;
  /** When no daily time covers a goal that isn't an exam: the date their time covers it all by. */
  fittingDate: string | null;
  fullDepth: boolean;
  /** When no daily time covers the goal: the share the most time a day covers by its date. */
  maximumShare: number | null;
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

type BehindChoices = Omit<FallingBehind, "coveredAfter" | "coveredBefore">;

/**
 * What the learner can choose when falling behind, read from a computed plan: the daily time to
 * offer and what it covers, the date their time covers it all by, and whether they can focus.
 */
export function getBehindChoices(
  computed: Pick<ComputedPlan, "feasibility" | "state">,
): BehindChoices {
  const { feasibility } = computed;
  const dailyTime = computed.state.goal.dailyMinutes;
  const recommended = getRecommendedTime(feasibility);
  const { fittingDate } = feasibility;

  return {
    canFocus: hasAreasToFocus(computed.state),
    currentMinutes: dailyTime,
    dailyMinutes: getMoreTime({ ...feasibility, dailyMinutes: dailyTime })?.dailyMinutes ?? null,
    fittingDate: fittingDate ? toIsoDate(fittingDate) : null,
    fullDepth: feasibility.recommendedMinutes !== null,
    maximumShare:
      recommended?.kind === "more" ? toWholePercent(recommended.coveredShare) / PERCENT : null,
    measure: feasibility.measure,
  };
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

  if (before === null || !feasibility.deadline) {
    return null;
  }

  const after = feasibility.coveredShare;
  const lostWhole = toWholePercent(before) >= PERCENT && toWholePercent(after) < PERCENT;

  if (!lostWhole && before - after < NOTICE_DROP) {
    return null;
  }

  return {
    ...getBehindChoices(computed),
    coveredAfter: toWholePercent(after) / PERCENT,
    coveredBefore: toWholePercent(before) / PERCENT,
  };
}
