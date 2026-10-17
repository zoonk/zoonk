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

/** The same items in the same order, each on the same day and in the same phase. */
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

/** The stored items, keyed as a planning run keys them. */
function toKeyedItems(context: PlanContext) {
  return context.items.map((item) => ({ ...item, key: getItemKey(item) }));
}

/** Each item's work and where it stands, in any order. */
function listWork(items: readonly Pick<PlannedItem, "key" | "status">[]): string[] {
  return items.map((item) => `${item.key}:${item.status}`).toSorted();
}

/** A fresh bank or changed day budget changes real work, even when every logical item stays. */
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
 * A planning run that changes nothing: the same graph, settings (pace included) and goal dates,
 * and the same work to do. Its days aren't compared: the same work planned again can land on
 * other days (an exam's study cycle starts over where a run re-plans from), and moving what the
 * learner was shown when nothing changed is churn. Saving it would also bump the plan's version,
 * which turns a learner's open plan editor or a buddy's plan change into a conflict.
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
    // The lessons each build counted are saved with a plan the run writes, never a reason to write
    // one: a recount alone that wrote the plan laid out its days again (R32).
    isDeepStrictEqual(
      withoutPlannedLessons(state.graph),
      withoutPlannedLessons(context.state.graph),
    ) &&
    isDeepStrictEqual(state.settings, context.state.settings) &&
    hasSameWorkload({ computed, context }) &&
    isDeepStrictEqual(listWork(computed.built.items), listWork(toKeyedItems(context)))
  );
}
