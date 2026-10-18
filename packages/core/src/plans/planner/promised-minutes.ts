import { listIntervalPortions } from "./interval-study-minutes";
import { findDayMock } from "./mock-day";
import { toIsoDate } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, getCumulativeCapacity } from "./schedule-units";
import { splitStandIns } from "./stand-in-parts";

/** The lesson the learner was promised by a day, its key, and the lesson minutes it needs by then. */
export type PromisedLesson = { dueBy: Date; key: string; minutes: number };

/**
 * The lesson the learner was promised by a day the run lays out (from `start`): the next one of the
 * chapter they're in the middle of, by the day the plan they saw has it on (`QueueUnit.dueBy`).
 * It needs its lesson minutes by then, as the plan dates it: a stand-in, by its first part's (see
 * `joinStandIns`), so the weeks of lessons not written yet aren't promised before it opens. Null
 * when there's none, or its day comes before the run's new work (this week's kept work).
 */
export function findPromisedLesson({
  start,
  units,
}: {
  start: Date;
  units: readonly QueueUnit[];
}): PromisedLesson | null {
  const unit = units.find((item) => item.dueBy);
  const dueBy = unit?.dueBy;

  if (!unit || !dueBy || dueBy < start) {
    return null;
  }

  return { dueBy, key: unit.key, minutes: splitStandIns([unit])[0]?.minutes ?? unit.minutes };
}

/**
 * The lesson minutes the promised lesson (see `findPromisedLesson`) keeps on each day, by its key
 * and then the day, so funding a mock never takes them (see `getKeptMinutes`): its last lesson
 * minutes up to the end of its day, the day before taking what its day can't hold. From the run's
 * first day only: a first lesson due on it runs into the next one, as the plan has it. None on a
 * mock's own day: the learner moved it there.
 */
export function listPromisedLessonMinutes({
  days,
  promised,
}: {
  /** The run's days, from where its new work starts. */
  days: readonly PlanDay[];
  promised: PromisedLesson | null;
}): Map<string, Map<string, number>> {
  const due = promised?.dueBy.getTime();
  const dueIndex = days.findIndex((day) => day.date.getTime() === due);
  const dueDay = days[dueIndex];

  if (!promised || !dueDay || findDayMock(dueDay.shape)) {
    return new Map();
  }

  const before = days.slice(0, dueIndex + 1);
  const cumulative = getCumulativeCapacity(before);
  const end = cumulative.at(-1) ?? 0;

  const portions = listIntervalPortions({
    cumulative,
    days: before,
    end,
    start: Math.max(0, end - promised.minutes),
  });

  const lessonDays = new Map(
    portions.flatMap(({ index, lessonMinutes }) => {
      const day = before[index];
      return day ? [[toIsoDate(day.date), lessonMinutes] as const] : [];
    }),
  );

  return new Map([[promised.key, lessonDays]]);
}
