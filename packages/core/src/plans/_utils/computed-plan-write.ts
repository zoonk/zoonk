import { toIsoDate } from "../planner/plan-calendar";
import { getFittedStandInLessons } from "../planner/plan-effect";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";
import { withSelectedItemFacts } from "./selected-item-contract";
import { type PlanWrite } from "./write-plan";

const MINUTES_PER_HOUR = 60;

/** The same selected build's items and owned, versioned facts are committed atomically. */
export function toComputedPlanWrite({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): PlanWrite {
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
    summary: {
      basis: {
        inputVersion: context.plan.inputVersion,
        planId: context.plan.id,
        planVersion: context.plan.version + 1,
        studyDay: toIsoDate(context.today),
        timeZone: context.timeZone,
        userId: context.goal.userId,
      },
      schemaVersion: 1,
      selected,
    },
  };
}
