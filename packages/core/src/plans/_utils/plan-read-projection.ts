import "server-only";
import { type SelectedDayPlan } from "../../sessions/_utils/selected-day-plan";
import { getFittedStandInLessons } from "../planner/plan-effect";
import { type ExistingPlanItem, getItemKey } from "../planner/plan-items";
import { type PlanContext } from "./plan-context";
import { isStandIn } from "./stand-in-lessons";

const MINUTES_PER_HOUR = 60;

/** Read-only selection: unsaved items cannot be passed as persisted mutation preconditions. */
export type PlanReadItem = Omit<ExistingPlanItem, "id"> & {
  id: string | null;
  key?: string;
  minutes?: number | null;
};

export type PlanReadContext = Omit<PlanContext, "items"> & { items: PlanReadItem[] };

/** Internal grouping identity only; public IDs and action URLs always use the untouched item.id. */
export function getPlanReadItemKey(item: PlanReadItem): string {
  return item.key ?? getItemKey(item);
}

/** Reuses the actual selected value. No producer, database write, invented row ID, or extra cache. */
export function projectPlanForRead({
  computed,
  context,
  items,
  phases,
  state,
}: SelectedDayPlan): PlanReadContext {
  const fitted = computed
    ? getFittedStandInLessons({
        skillMinutes: computed.built.skillMinutes,
        standInLessons: computed.standInLessons,
      })
    : null;

  return {
    ...context,
    items: fitted
      ? items.map((item) => ({
          ...item,
          lessons: isStandIn(item) ? (fitted.get(item.skillId ?? "") ?? null) : null,
        }))
      : items,
    phases,
    plan: {
      ...context.plan,
      estimateHours: computed
        ? computed.built.estimate.totalMinutes / MINUTES_PER_HOUR
        : context.plan.estimateHours,
    },
    state,
  };
}
