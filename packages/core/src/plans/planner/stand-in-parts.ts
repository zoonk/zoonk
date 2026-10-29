import { type StudyPortion } from "./interval-study-minutes";
import { isStandInUnit } from "./plan-item-rules";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";

export function splitStandIns(units: readonly QueueUnit[]): QueueUnit[] {
  return units.flatMap((unit) => {
    if (!isStandInUnit(unit)) {
      return [unit];
    }

    const parts = Math.max(1, Math.round(unit.minutes / DEFAULT_LESSON_MINUTES));

    if (parts === 1) {
      return [unit];
    }

    return Array.from({ length: parts }, () => ({ ...unit, minutes: unit.minutes / parts }));
  });
}

export function joinStandIns<
  TUnit extends QueueUnit & {
    date?: Date;
    studyMinutes: number;
    studyPortions?: StudyPortion[];
    teachingEnd?: Date;
  },
>(units: readonly TUnit[]): TUnit[] {
  const totals = units.reduce((sums, unit) => {
    const sum = sums.get(unit.key) ?? { minutes: 0, studyMinutes: 0, studyPortions: [] };

    return sums.set(unit.key, {
      minutes: sum.minutes + unit.minutes,
      studyMinutes: sum.studyMinutes + unit.studyMinutes,
      studyPortions: [...sum.studyPortions, ...(unit.studyPortions ?? [])],
    });
  }, new Map<string, { minutes: number; studyMinutes: number; studyPortions: StudyPortion[] }>());

  const firstIndex = units.reduce(
    (first, unit, index) => (first.has(unit.key) ? first : first.set(unit.key, index)),
    new Map<string, number>(),
  );

  const ends = units.reduce((latest, unit) => {
    const end = unit.teachingEnd ?? unit.date;
    const before = latest.get(unit.key);
    return end && (!before || end > before) ? latest.set(unit.key, end) : latest;
  }, new Map<string, Date>());

  return units
    .filter((unit, index) => firstIndex.get(unit.key) === index)
    .map((unit) => {
      const end = ends.get(unit.key);
      const later = end && unit.date && end > unit.date ? { teachingEnd: end } : {};
      const { studyPortions = [], ...total } = totals.get(unit.key) ?? {};

      return {
        ...unit,
        ...total,
        ...(studyPortions.length > 0 ? { studyPortions } : {}),
        ...later,
      };
    });
}
