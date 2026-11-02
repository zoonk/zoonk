import { toIsoDate } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { type PlanDay } from "./schedule-units";

function firstAfter(cumulative: readonly number[], point: number): number {
  const search = (low: number, high: number): number => {
    if (low >= high) {
      return low;
    }

    const middle = Math.floor((low + high) / 2);
    return (cumulative[middle] ?? 0) > point ? search(low, middle) : search(middle + 1, high);
  };

  return search(0, cumulative.length);
}

export function toDayMinutes({ lessonMinutes, share }: { lessonMinutes: number; share: number }) {
  return lessonMinutes / (share || 1);
}

export function getOneDayStudy({
  date,
  lessonMinutes,
  share,
}: {
  date: Date;
  lessonMinutes: number;
  share: number;
}): { studyMinutes: number; studyPortions: StudyPortion[] } {
  const minutes = toDayMinutes({ lessonMinutes, share });

  return {
    studyMinutes: minutes,
    studyPortions: [{ date: toIsoDate(date), lessonMinutes, minutes }],
  };
}

export type IntervalPortion = { index: number; lessonMinutes: number; studyMinutes: number };

export function listIntervalPortions({
  cumulative,
  days,
  end,
  start,
}: {
  cumulative: readonly number[];
  days: readonly PlanDay[];
  end: number;
  start: number;
}): IntervalPortion[] {
  const from = firstAfter(cumulative, start);
  const until = Math.min(days.length, firstAfter(cumulative, end) + 1);

  return days.slice(from, until).flatMap((day, offset) => {
    const index = from + offset;
    const dayStart = cumulative[index - 1] ?? 0;
    const dayEnd = cumulative[index] ?? dayStart;
    const lessonMinutes = Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart));

    return lessonMinutes > 0
      ? [
          {
            index,
            lessonMinutes,
            studyMinutes: toDayMinutes({ lessonMinutes, share: day.shape.share }),
          },
        ]
      : [];
  });
}

export type StudyPortion = { date: string; lessonMinutes: number; minutes: number };

export function getUnitStudy({
  cumulative,
  days,
  dueDate,
  overflowShare,
  start,
  unit,
}: {
  cumulative: readonly number[];
  days: readonly PlanDay[];
  dueDate: Date;
  overflowShare: number;
  start: number;
  unit: Pick<QueueUnit, "kind" | "minutes">;
}): { studyMinutes: number; studyPortions: StudyPortion[] } {
  if (unit.kind === "boss") {
    return {
      studyMinutes: toDayMinutes({ lessonMinutes: unit.minutes, share: overflowShare }),
      studyPortions: [],
    };
  }

  const end = start + unit.minutes;

  const covered = listIntervalPortions({ cumulative, days, end, start }).flatMap((portion) => {
    const day = days[portion.index];

    return day
      ? [
          {
            date: toIsoDate(day.date),
            lessonMinutes: portion.lessonMinutes,
            minutes: portion.studyMinutes,
          },
        ]
      : [];
  });

  const overflow = Math.max(0, end - Math.max(start, cumulative.at(-1) ?? 0));
  const uncovered = toDayMinutes({ lessonMinutes: overflow, share: overflowShare });

  const studyPortions =
    uncovered > 0
      ? [...covered, { date: toIsoDate(dueDate), lessonMinutes: overflow, minutes: uncovered }]
      : covered;

  return {
    studyMinutes: studyPortions.reduce((total, portion) => total + portion.minutes, 0),
    studyPortions,
  };
}

function listLessonDayMinutes({
  field,
  kept,
  units,
}: {
  field: "lessonMinutes" | "minutes";
  kept: ReadonlyMap<string, readonly StudyPortion[]>;
  units: readonly { key: string; studyPortions?: readonly StudyPortion[] }[];
}): Map<string, Map<string, number>> {
  const sum = (portions: readonly StudyPortion[]) =>
    portions.reduce(
      (days, portion) => days.set(portion.date, (days.get(portion.date) ?? 0) + portion[field]),
      new Map<string, number>(),
    );

  const laid = units.reduce((byKey, unit) => {
    const portions = unit.studyPortions ?? [];

    return portions.length > 0
      ? byKey.set(unit.key, [...(byKey.get(unit.key) ?? []), ...portions])
      : byKey;
  }, new Map<string, StudyPortion[]>());

  const keys = new Set([...laid.keys(), ...kept.keys()]);

  return new Map(
    [...keys].map((key) => {
      const own = sum(laid.get(key) ?? []);
      const keptDays = sum(kept.get(key) ?? []);
      const days = new Map([...keptDays, ...own]);
      return [key, days] as const;
    }),
  );
}

export function listLessonDays(
  units: Parameters<typeof listLessonDayMinutes>[0]["units"],
  kept: ReadonlyMap<string, readonly StudyPortion[]> = new Map(),
) {
  return {
    lessonDayMinutes: listLessonDayMinutes({ field: "minutes", kept, units }),
    lessonRawMinutes: listLessonDayMinutes({ field: "lessonMinutes", kept, units }),
  };
}
