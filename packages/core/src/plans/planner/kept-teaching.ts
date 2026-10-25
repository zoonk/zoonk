import { toDayMinutes } from "./interval-study-minutes";
import { findDayMock } from "./mock-day";
import { type DayShape, type PlanDay } from "./schedule-units";

/** The minutes a day's kept time is rounded to (see `getKeptMinutes`). */
const KEPT_PRECISION = 1e-9;

/** Lesson minutes by a lesson's key and then a day (ISO date). */
export type LessonDays = ReadonlyMap<string, ReadonlyMap<string, number>>;

/**
 * The promised lesson's minutes on each day from `from` to `to` (see `listPromisedLessonMinutes`).
 * Only the days that keep any.
 */
function listKeptLessonDays({
  from,
  promised,
  to,
}: {
  from: string;
  promised: LessonDays;
  to: string;
}): Map<string, Map<string, number>> {
  const byDay = new Map<string, Map<string, number>>();

  for (const [key, days] of promised) {
    for (const [date, minutes] of days) {
      if (date >= from && date <= to) {
        const lessons = byDay.get(date) ?? new Map<string, number>();
        lessons.set(key, minutes);
        byDay.set(date, lessons);
      }
    }
  }

  return byDay;
}

/**
 * The day minutes a day keeps from a mock's funding (see `getSpendable`), after its fixed events:
 * its kept lesson minutes (see `listKeptLessonDays`) at the day's own share now. Equal layouts can
 * sum a day's lesson minutes in a different order: rounded, the same plan funds its mocks with the
 * same minutes, so a run on it saves nothing new.
 */
function getKeptMinutes({
  lessons,
  share,
}: {
  lessons: ReadonlyMap<string, number> | undefined;
  share: number;
}): number {
  const lessonMinutes = [...(lessons?.values() ?? [])].reduce(
    (total, minutes) => total + minutes,
    0,
  );

  return Math.round(toDayMinutes({ lessonMinutes, share }) / KEPT_PRECISION) * KEPT_PRECISION;
}

/**
 * Where a mock's funding stops reading what days keep: before the next mock the plan lays (that
 * mock's funding keeps its own days again).
 */
function findReadEnd({ days, index }: { days: readonly PlanDay[]; index: number }): number {
  for (let at = Math.max(0, index + 1); at < days.length; at += 1) {
    const day = days[at];

    if (day && findDayMock(day.shape)) {
      return at;
    }
  }

  return days.length;
}

/**
 * The days a mock's funding reads, from its window's start (`windowStart`, an index of `days`) to
 * the day before the next mock (see `findReadEnd`), each keeping the promised lesson's teaching at
 * its share now (see `getKeptMinutes`; a mock's own day keeps none, its funding decides; one keeping
 * nothing keeps nothing an earlier mock's funding left it). `labels` are the days' ISO dates.
 */
export function keepWindowTeaching({
  days,
  index,
  labels,
  promised,
  shapes,
  windowStart,
}: {
  days: readonly PlanDay[];
  index: number;
  labels: readonly string[];
  promised: LessonDays;
  shapes: DayShape[];
  windowStart: number;
}): void {
  const start = labels[windowStart] ?? "";
  const end = findReadEnd({ days, index });
  const lessonDays = listKeptLessonDays({ from: start, promised, to: labels[end - 1] ?? start });

  for (let at = windowStart; at < end; at += 1) {
    const shape = shapes[at];

    if (shape && !findDayMock(shape)) {
      const { kept: residue, ...rest } = shape;
      const lessons = lessonDays.get(labels[at] ?? "");
      const minutes = lessons ? getKeptMinutes({ lessons, share: shape.share }) : 0;

      if (minutes > 0) {
        shapes[at] = { ...rest, kept: minutes };
      } else if (residue !== undefined) {
        shapes[at] = rest;
      }
    }
  }
}
