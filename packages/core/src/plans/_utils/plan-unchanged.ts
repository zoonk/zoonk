import { isDeepStrictEqual } from "node:util";
import { withoutPlannedLessons } from "../planner/core-first";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlannedItem, getItemKey } from "../planner/plan-items";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { type ComputedPlan } from "./replan";
import { readSelectedItemFacts } from "./selected-item-contract";

export function getGoalUpdate({ context, state }: { context: PlanContext; state: PlanState }) {
  const targetDate = getStateTargetDate(state);
  const sameDate = targetDate?.getTime() === context.goal.targetDate?.getTime();

  if (state.goal.dailyMinutes === context.goal.dailyMinutes && sameDate) {
    return null;
  }

  return { dailyMinutes: state.goal.dailyMinutes, targetDate };
}

function toDay(date: Date | null): string | null {
  return date ? toIsoDate(date) : null;
}

export function hasSameItems({
  after,
  before,
}: {
  after: readonly Pick<PlannedItem, "key" | "phase" | "scheduledFor">[];
  before: readonly Pick<PlannedItem, "key" | "phase" | "scheduledFor">[];
}) {
  return (
    after.length === before.length &&
    after.every((item, index) => {
      const current = before[index];

      return (
        current !== undefined &&
        item.key === current.key &&
        item.phase === current.phase &&
        toDay(item.scheduledFor) === toDay(current.scheduledFor)
      );
    })
  );
}

function toKeyedItems(context: PlanContext) {
  return context.items.map((item) => ({ ...item, key: getItemKey(item) }));
}

function listWork(items: readonly Pick<PlannedItem, "key" | "status">[]): string[] {
  return items.map((item) => `${item.key}:${item.status}`).toSorted();
}

function hasSameWorkload({ computed, context }: { computed: ComputedPlan; context: PlanContext }) {
  const minutes = new Map(computed.built.items.map((item) => [item.key, item.minutes]));

  return context.items.every((item) => {
    if (
      item.status !== "todo" ||
      (item.scheduledFor !== null && item.scheduledFor < context.today)
    ) {
      return true;
    }

    const saved = readSelectedItemFacts(item.facts)?.minutes ?? item.minutes;
    return saved === null || saved === undefined || saved === minutes.get(getItemKey(item));
  });
}

/**
 * Days aren't compared: the same work planned again can land on other days, and moving what the
 * learner saw when nothing changed is churn.
 */
export function isPlanUnchanged({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): boolean {
  const { state } = computed;

  return (
    getGoalUpdate({ context, state }) === null &&
    isDeepStrictEqual(
      withoutPlannedLessons(state.graph),
      withoutPlannedLessons(context.state.graph),
    ) &&
    isDeepStrictEqual(state.settings, context.state.settings) &&
    hasSameWorkload({ computed, context }) &&
    isDeepStrictEqual(listWork(computed.built.items), listWork(toKeyedItems(context)))
  );
}
