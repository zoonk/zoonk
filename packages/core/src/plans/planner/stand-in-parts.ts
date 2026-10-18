import { type StudyPortion } from "./interval-study-minutes";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";

/** A stand-in: the lessons of a skill the Library hasn't outlined yet, planned as one unit. */
function isStandIn(unit: QueueUnit): boolean {
  return unit.kind === "lesson" && unit.lessonId === null && unit.skillId !== null;
}

/**
 * Splits each stand-in into parts about a lesson long, all under the stand-in's key, so a study
 * cycle shares a day between a skill not outlined yet and the other subjects: whole, a stand-in
 * rarely fits a subject's share of a day, so the day's first subject would take it all.
 */
export function splitStandIns(units: readonly QueueUnit[]): QueueUnit[] {
  return units.flatMap((unit) => {
    if (!isStandIn(unit)) {
      return [unit];
    }

    const parts = Math.max(1, Math.round(unit.minutes / DEFAULT_LESSON_MINUTES));

    // A part split again (a study cycle splits what the cut already split) stays one: as it is.
    if (parts === 1) {
      return [unit];
    }

    return Array.from({ length: parts }, () => ({ ...unit, minutes: unit.minutes / parts }));
  });
}

/**
 * Joins a stand-in's scheduled parts back into one unit (one plan item per stand-in): on the day
 * its first part is due, when the learner needs its lessons, with the time of every part that fit,
 * and each part's day by day (`studyPortions`).
 */
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

  // Joined, a stand-in teaches until its last part's time ends (see `teachingEnd`).
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
