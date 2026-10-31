import { type QueueUnit } from "./plan-units";
import { type PlanDay, type ScheduledUnit, getLessonCapacity } from "./schedule-units";
import { type CadencedArea } from "./study-cycle-lanes";
import { type WrittenSchedule, getEffectiveCadence, isWrittenDay } from "./written-cadence";

const MAX_CONCENTRATED_SHARE = 0.5;

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

type LessonDay = { capacity: number; index: number; written: boolean };

function getOpenDays({
  days,
  lastLesson,
  schedule,
  total,
}: {
  days: readonly PlanDay[];
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
