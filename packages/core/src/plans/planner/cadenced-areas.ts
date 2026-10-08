import { type QueueUnit } from "./plan-units";
import { type PlanDay, type ScheduledUnit, getLessonCapacity } from "./schedule-units";
import { type CadencedArea } from "./study-cycle-lanes";
import { type WrittenSchedule, getEffectiveCadence, isWrittenDay } from "./written-cadence";

/**
 * Concentrated, the written tests take no more than about half of a day's lessons: when their
 * practice wouldn't fit their days at that, more days join (see `getOpenDays`).
 */
const MAX_CONCENTRATED_SHARE = 0.5;

/** The written tests' lesson minutes a schedule holds, by area. */
function sumWrittenMinutes({
  scheduled,
  written,
}: {
  scheduled: readonly QueueUnit[];
  written: ReadonlySet<string>;
}): Map<string, number> {
  return scheduled
    .filter((unit) => unit.kind === "lesson" && written.has(unit.area))
    .reduce(
      (areas, unit) => areas.set(unit.area, (areas.get(unit.area) ?? 0) + unit.minutes),
      new Map<string, number>(),
    );
}

/** How many extra days join: none when the days fit, else up to the first that covers it all. */
function getExtraCount({
  extra,
  needed,
  reached,
}: {
  extra: number;
  needed: number;
  reached: number;
}): number {
  if (needed <= 0) {
    return 0;
  }

  return reached === -1 ? extra : reached + 1;
}

/** A day with lesson time, and whether the learner's cadence practices writing on it. */
type LessonDay = { capacity: number; index: number; written: boolean };

/**
 * The days with lesson time the written tests are practiced on (see `isWrittenDay`): the final
 * weeks, or every week or every other week while the plan has lessons. When their minutes
 * wouldn't fit those days at `MAX_CONCENTRATED_SHARE`, the days next to them join, as few as it
 * takes: the latest before the final weeks, or the next other weeks.
 */
function getOpenDays({
  days,
  lastLesson,
  schedule,
  total,
}: {
  days: readonly PlanDay[];
  /** The plan's last day with lessons when practiced every week. */
  lastLesson: number;
  schedule: WrittenSchedule;
  total: number;
}): Set<number> {
  const finalWeeks = getEffectiveCadence(schedule) === "finalWeeks";

  const lessonDays = days.flatMap((day, index): LessonDay[] => {
    const capacity = getLessonCapacity(day);
    const written = isWrittenDay({ ...schedule, date: day.date });
    return capacity > 0 ? [{ capacity, index, written }] : [];
  });

  const isBase = (day: LessonDay) => day.written && (finalWeeks || day.index <= lastLesson);
  const base = lessonDays.filter((day) => isBase(day));

  const extra = finalWeeks
    ? lessonDays.filter((day) => !day.written).toReversed()
    : lessonDays.filter((day) => day.written && !isBase(day));

  const needed = total / MAX_CONCENTRATED_SHARE - base.reduce((sum, day) => sum + day.capacity, 0);

  const sums = extra.reduce<number[]>((totals, day) => {
    totals.push((totals.at(-1) ?? 0) + day.capacity);
    return totals;
  }, []);

  const reached = sums.findIndex((sum) => sum >= needed);
  const count = getExtraCount({ extra: extra.length, needed, reached });

  return new Set([...base, ...extra.slice(0, count)].map((day) => day.index));
}

/**
 * The written tests as areas practiced on days of their own, by the learner's cadence: each gets
 * the lesson minutes it gets in the study cycle's rotation (`scheduled`: the plan laid out that
 * way), spread evenly over its days, so its practice moves without shrinking or growing. Every
 * week, its days are every day the plan has lessons: in the rotation, ENEM's redação, a few
 * dozen lessons, was done in the plan's first two weeks and never came back. Null when the plan
 * has no time for them.
 */
export function getCadencedAreas({
  days,
  schedule,
  scheduled,
  written,
}: {
  days: readonly PlanDay[];
  schedule: WrittenSchedule;
  scheduled: readonly ScheduledUnit[];
  written: ReadonlySet<string>;
}): Map<string, CadencedArea> | null {
  if (written.size === 0) {
    return null;
  }

  const minutes = sumWrittenMinutes({ scheduled, written });
  const total = [...minutes.values()].reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return null;
  }

  const lastDate = scheduled.reduce((last, unit) => Math.max(last, unit.date.getTime()), 0);
  const lastLesson = days.findLastIndex((day) => day.date.getTime() <= lastDate);
  const openDays = getOpenDays({ days, lastLesson, schedule, total });

  return new Map([...minutes].map(([area, value]) => [area, { minutes: value, openDays }]));
}
