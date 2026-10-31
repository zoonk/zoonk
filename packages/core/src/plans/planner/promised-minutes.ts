import { listIntervalPortions } from "./interval-study-minutes";
import { findDayMock } from "./mock-day";
import { toIsoDate } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, getCumulativeCapacity } from "./schedule-units";
import { splitStandIns } from "./stand-in-parts";

export type PromisedLesson = { dueBy: Date; key: string; minutes: number };

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

export function listPromisedLessonMinutes({
  days,
  promised,
}: {
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
