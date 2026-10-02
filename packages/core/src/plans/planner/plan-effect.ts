import { daysBetween, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem, getItemKey } from "./plan-items";

type EffectItem = Pick<
  PlannedItem,
  "chapterId" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId" | "status"
> & { id: string | null };

/** What a change does to what's left: lessons added or removed and when the plan ends. */
export type PlanEffect = {
  endDateAfter: string | null;
  endDateBefore: string | null;
  lessonsAdded: number;
  lessonsRemoved: number;
};

/** A change is small when it moves at most one lesson and the end date by at most a day. */
const SMALL_CHANGE_LESSONS = 1;
const SMALL_CHANGE_DAYS = 1;

/**
 * A lesson item is one lesson; a stand-in counts the lessons it plans: the whole skill when no
 * lesson teaches it yet, the rest when the Library outlined part of it.
 */
export function countItemLessons({
  item,
  standInLessons,
}: {
  item: Pick<EffectItem, "lessonId" | "skillId">;
  standInLessons: ReadonlyMap<string, number>;
}): number {
  return item.lessonId ? 1 : (standInLessons.get(item.skillId ?? "") ?? 1);
}

function getLessonCounts({
  items,
  standInLessons,
}: {
  items: readonly EffectItem[];
  standInLessons: ReadonlyMap<string, number>;
}) {
  return new Map(
    items
      .filter((item) => item.status === "todo" && item.kind === "lesson")
      .map((item) => [
        getItemKey({ ...item, id: item.id ?? "" }),
        countItemLessons({ item, standInLessons }),
      ]),
  );
}

function getEndDate(items: readonly EffectItem[]): string | null {
  const last = items
    .filter((item) => item.status === "todo" && item.scheduledFor)
    .map((item) => item.scheduledFor?.getTime() ?? 0)
    .reduce((latest, time) => Math.max(latest, time), 0);

  return last > 0 ? toIsoDate(new Date(last)) : null;
}

function countMissing({ from, to }: { from: Map<string, number>; to: Map<string, number> }) {
  return [...from].reduce((total, [key, lessons]) => total + (to.has(key) ? 0 : lessons), 0);
}

/** Compares what was left to do before a change with what is left after it. */
export function getPlanEffect({
  after,
  before,
  standInLessons,
}: {
  after: readonly EffectItem[];
  before: readonly EffectItem[];
  /** The lessons each skill's stand-in plans, from `getStandInLessons`. */
  standInLessons: ReadonlyMap<string, number>;
}): PlanEffect {
  const beforeLessons = getLessonCounts({ items: before, standInLessons });
  const afterLessons = getLessonCounts({ items: after, standInLessons });

  return {
    endDateAfter: getEndDate(after),
    endDateBefore: getEndDate(before),
    lessonsAdded: countMissing({ from: afterLessons, to: beforeLessons }),
    lessonsRemoved: countMissing({ from: beforeLessons, to: afterLessons }),
  };
}

/** Changes bigger than a lesson wait for the learner's OK before they apply. */
export function needsApproval(effect: PlanEffect): boolean {
  const { endDateAfter, endDateBefore } = effect;

  const shift =
    endDateAfter && endDateBefore
      ? Math.abs(daysBetween(fromIsoDate(endDateBefore), fromIsoDate(endDateAfter)))
      : Number(endDateAfter !== endDateBefore) * (SMALL_CHANGE_DAYS + 1);

  return (
    effect.lessonsAdded + effect.lessonsRemoved > SMALL_CHANGE_LESSONS || shift > SMALL_CHANGE_DAYS
  );
}
