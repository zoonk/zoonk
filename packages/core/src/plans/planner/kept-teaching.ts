import { toDayMinutes } from "./interval-study-minutes";
import { findDayMock } from "./mock-day";
import { type DayShape, type PlanDay } from "./schedule-units";

const KEPT_PRECISION = 1e-9;

export type LessonDays = ReadonlyMap<string, ReadonlyMap<string, number>>;

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
 * Rounded: equal layouts can sum a day's minutes in another order, and the same plan must fund its
 * mocks with the same minutes.
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

function findReadEnd({ days, index }: { days: readonly PlanDay[]; index: number }): number {
  for (let at = Math.max(0, index + 1); at < days.length; at += 1) {
    const day = days[at];

    if (day && findDayMock(day.shape)) {
      return at;
    }
  }

  return days.length;
}

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
