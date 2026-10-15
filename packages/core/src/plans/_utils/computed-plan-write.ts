import { getFittedStandInLessons } from "../planner/plan-effect";
import { type PlanContext } from "./plan-context";
import { type PlanInputKeys } from "./plan-input-classes";
import { toPlanSummary } from "./plan-summary";
import { type ComputedPlan } from "./replan";
import { withSelectedItemFacts } from "./selected-item-contract";
import { type PlanWrite } from "./write-plan";

const MINUTES_PER_HOUR = 60;

/**
 * The same selected build's items and owned, versioned facts are committed atomically, with the
 * keys of what it was planned from (see `getPlanInputKeys`) when the run computed them.
 */
export function toComputedPlanWrite({
  computed,
  context,
  layoutKeys = null,
}: {
  computed: ComputedPlan;
  context: PlanContext;
  layoutKeys?: PlanInputKeys | null;
}): PlanWrite {
  const { built, selected } = computed;

  return {
    coveredShare: selected.coverage?.coveredShare ?? null,
    estimateHours: built.estimate.totalMinutes / MINUTES_PER_HOUR,
    inputsKey: computed.inputsKey,
    items: withSelectedItemFacts({ facts: computed.itemFacts, items: built.items }),
    layoutKeys,
    phases: built.phases,
    sourceSkillIds: selected.sourceSkillIds,
    standInLessons: getFittedStandInLessons({
      skillMinutes: built.skillMinutes,
      standInLessons: computed.standInLessons,
    }),
    state: computed.state,
    summary: toPlanSummary({ context, selected }),
  };
}
