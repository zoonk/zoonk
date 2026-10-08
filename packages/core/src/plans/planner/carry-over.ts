import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, getLessonCapacity } from "./schedule-units";

/**
 * A new day settles what earlier days left: the lessons the learner was given and didn't finish
 * (`lessonIds`: the last study day's session, which may have drawn lessons due later) and the
 * lessons due before today. Only the day's own settling carries them; a change the learner makes
 * plans from today in the order their change asks for.
 */
export type CarryOver = { lessonIds: readonly string[] };

const LEARN_KINDS = new Set<ExistingPlanItem["kind"]>(["chapter", "lesson"]);

/** A lesson or chapter to study: a stand-in for lessons not outlined yet has nothing to teach. */
function isTeachable(item: ExistingPlanItem): boolean {
  return LEARN_KINDS.has(item.kind) && (item.lessonId !== null || item.chapterId !== null);
}

/**
 * The keys of the work earlier days left, in the plan's order: what the learner was given and
 * didn't finish, and what was due before today.
 */
export function listCarriedKeys({
  carryOver,
  items,
  today,
}: {
  carryOver?: CarryOver | null;
  items: readonly ExistingPlanItem[];
  today: Date;
}): string[] {
  if (!carryOver) {
    return [];
  }

  const given = new Set(carryOver.lessonIds);

  return items
    .filter(
      (item) =>
        item.status === "todo" &&
        isTeachable(item) &&
        ((item.scheduledFor !== null && item.scheduledFor < today) ||
          (item.lessonId !== null && given.has(item.lessonId))),
    )
    .toSorted((a, b) => a.position - b.position)
    .map((item) => getItemKey(item));
}

/** The units earlier days left, in the order they were planned, and the rest in queue order. */
export function splitCarriedUnits({
  keys,
  units,
}: {
  keys: readonly string[];
  units: readonly QueueUnit[];
}): { carried: QueueUnit[]; rest: QueueUnit[] } {
  const order = new Map(keys.map((key, index) => [key, index]));

  return {
    carried: units
      .filter((unit) => order.has(unit.key))
      .toSorted((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)),
    rest: units.filter((unit) => !order.has(unit.key)),
  };
}

/**
 * The days with the lesson time carried work takes from the first ones, so the rest of the plan
 * fills what's left: the day keeps its size, and what doesn't fit moves on.
 */
export function reserveCarriedTime({
  days,
  minutes,
}: {
  days: readonly PlanDay[];
  minutes: number;
}): PlanDay[] {
  return days.reduce<{ days: PlanDay[]; left: number }>(
    (state, day) => {
      const reserved = Math.min(state.left, getLessonCapacity(day));

      state.days.push(reserved > 0 ? { ...day, shape: { ...day.shape, reserved } } : day);
      return { days: state.days, left: state.left - reserved };
    },
    { days: [], left: minutes },
  ).days;
}
