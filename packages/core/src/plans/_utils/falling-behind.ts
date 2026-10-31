import { getSkillArea } from "../planner/graph-areas";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";

const NOTICE_DROP = 0.02;

const PERCENT = 100;

export type FallingBehind = {
  canFocus: boolean;
  coveredAfter: number;
  coveredBefore: number;
  currentMinutes: number;
  measure: "exam" | "goal";
};

function hasAreasToFocus({ graph, settings }: Pick<PlanState, "graph" | "settings">): boolean {
  const skipped = new Set(settings.skippedAreas);
  const areas = new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })));

  return [...areas].filter((area) => !skipped.has(area)).length > 1;
}

function toWholePercent(share: number): number {
  return Math.round(share * PERCENT);
}

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
