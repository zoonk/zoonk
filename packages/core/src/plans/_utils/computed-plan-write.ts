import { getFittedStandInLessons } from "../planner/plan-effect";
import { type ComputedPlan } from "./replan";
import { withSelectedItemFacts } from "./selected-item-contract";
import { type PlanWrite } from "./write-plan";

const MINUTES_PER_HOUR = 60;

export function toComputedPlanWrite({ computed }: { computed: ComputedPlan }): PlanWrite {
  const { built, selected } = computed;

  return {
    coveredShare: selected.coverage?.coveredShare ?? null,
    estimateHours: built.estimate.totalMinutes / MINUTES_PER_HOUR,
    inputsKey: computed.inputsKey,
    items: withSelectedItemFacts({ facts: computed.itemFacts, items: built.items }),
    phases: built.phases,
    sourceSkillIds: selected.sourceSkillIds,
    standInLessons: getFittedStandInLessons({
      skillMinutes: built.skillMinutes,
      standInLessons: computed.standInLessons,
    }),
    state: computed.state,
  };
}
