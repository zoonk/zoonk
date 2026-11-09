import { isDeepStrictEqual } from "node:util";
import { isJsonObject } from "@zoonk/utils/json";
import { withLanguageAim } from "../../language/aims/language-aims";
import { withoutPlannedLessons } from "../planner/core-first";
import { getSkillArea } from "../planner/graph-areas";
import { getEndOfWeek, toIsoDate } from "../planner/plan-calendar";
import { type PlannedItem, getItemKey } from "../planner/plan-items";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { type ComputedPlan } from "./replan";
import { readSelectedItemFacts } from "./selected-item-contract";

/** The aim lives in the goal's details, where the language level pages read it too. */
function getAimDetails({ goal, state }: { goal: PlanContext["goal"]; state: PlanState }) {
  const { aim } = state.goal;

  if (aim === undefined || goal.kind !== "language") {
    return null;
  }

  return withLanguageAim({ aim, details: isJsonObject(goal.details) ? goal.details : {} });
}

export function getGoalUpdate({
  context,
  state,
}: {
  context: Pick<PlanContext, "goal">;
  state: PlanState;
}) {
  const targetDate = getStateTargetDate(state);
  const sameDate = targetDate?.getTime() === context.goal.targetDate?.getTime();
  const details = getAimDetails({ goal: context.goal, state });

  if (state.goal.dailyMinutes === context.goal.dailyMinutes && sameDate && !details) {
    return null;
  }

  return { dailyMinutes: state.goal.dailyMinutes, targetDate, ...(details && { details }) };
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

function restoresCourseOrder({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): boolean {
  const endOfWeek = getEndOfWeek(context.today);
  const { graph } = computed.state;

  const areas = new Map(
    graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

  const places = new Map(computed.built.items.map((item, place) => [item.key, place]));

  const laterLessons = context.items.flatMap((item) => {
    const rank = computed.courseRanks.get(item.lessonId ?? "");
    const place = places.get(getItemKey(item));
    const thisWeek = item.scheduledFor !== null && item.scheduledFor <= endOfWeek;

    if (item.kind !== "lesson" || item.status !== "todo" || item.chapterId === null || thisWeek) {
      return [];
    }

    if (rank === undefined || place === undefined) {
      return [];
    }

    return [{ group: `${item.chapterId}:${areas.get(item.skillId ?? "") ?? ""}`, place, rank }];
  });

  return [...Map.groupBy(laterLessons, (lesson) => lesson.group).values()].some((lessons) =>
    lessons.some((ahead, index) =>
      lessons
        .slice(index + 1)
        .some((behind) => ahead.rank > behind.rank && behind.place < ahead.place),
    ),
  );
}

/**
 * Days aren't compared: the same work planned again can land on other days, and moving what the
 * learner saw when nothing changed is churn. The one order compared is a chapter's within an area
 * after this week, and only for an automatic layout, which keeps this week as saved: a saved layout
 * holding a lesson there ahead of one the course teaches first, which the planner now lays out in
 * course order, is laid out again.
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
    isDeepStrictEqual(listWork(computed.built.items), listWork(toKeyedItems(context))) &&
    (computed.mode !== "automatic" || !restoresCourseOrder({ computed, context }))
  );
}
