import { reserveCarriedTime } from "./carry-over";
import { findDayIndex } from "./day-index";
import { type StudyPortion, listIntervalPortions } from "./interval-study-minutes";
import { type KeptPiece } from "./kept-items";
import { toIsoDate } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, type ScheduledUnit, getCumulativeCapacity } from "./schedule-units";

type LaidOut = {
  carriedSchedule: { units: readonly ScheduledUnit[] };
  restSchedule: { units: readonly ScheduledUnit[] };
};

/** Where a piece of this week's kept work runs in the plan's lesson minutes, and whose it is. */
type KeptInterval = { end: number; key: string; kind: QueueUnit["kind"]; start: number };

/**
 * This week's kept work as the run that saved it laid it out: each piece from the start of the day
 * it's saved for, after the ones before it, for its share of its unit's time. A phase's challenge
 * takes no more than its day, past its time (see `placeBoss`).
 */
function listKeptIntervals({
  cumulative,
  days,
  kept,
  units,
}: {
  cumulative: readonly number[];
  days: readonly PlanDay[];
  kept: readonly KeptPiece[];
  units: readonly QueueUnit[];
}): KeptInterval[] {
  const minutes = units.reduce(
    (totals, unit) => totals.set(unit.key, (totals.get(unit.key) ?? 0) + unit.minutes),
    new Map<string, number>(),
  );

  const kinds = new Map(units.map((unit) => [unit.key, unit.kind]));

  return kept
    .toSorted((a, b) => a.date.getTime() - b.date.getTime())
    .reduce<KeptInterval[]>((intervals, piece) => {
      const used = intervals.at(-1)?.end ?? 0;
      const index = days.findIndex((day) => day.date >= piece.date);
      const dayStart = index > 0 ? (cumulative[index - 1] ?? 0) : 0;
      const start = Math.max(used, dayStart);
      const end = start + (minutes.get(piece.key) ?? 0) * piece.share;
      const kind = kinds.get(piece.key) ?? "lesson";

      const clamped =
        kind === "boss" ? Math.min(end, Math.max(used, cumulative[index] ?? end)) : end;

      intervals.push({ end: clamped, key: piece.key, kind, start });
      return intervals;
    }, []);
}

/** The time this week's kept work takes past it, as the run that saved it laid it out. */
function getTimePastThisWeek({
  days,
  kept,
  start,
  units,
}: {
  days: readonly PlanDay[];
  kept: readonly KeptPiece[];
  start: Date;
  units: readonly QueueUnit[];
}): number {
  const cumulative = getCumulativeCapacity(days);
  const weekEnd = cumulative[days.findLastIndex((day) => day.date < start)] ?? 0;
  const used = listKeptIntervals({ cumulative, days, kept, units }).at(-1)?.end ?? 0;

  return Math.max(0, used - weekEnd);
}

/**
 * Each lesson of this week's kept work, by its key, with the time it takes on each of its days, as
 * the run that saved it laid it out (see `listKeptIntervals`): the plan's days hold it whether a run
 * lays it out again or keeps it. A challenge holds no lesson time.
 */
function listKeptPortions({
  days,
  kept,
  units,
}: {
  days: readonly PlanDay[];
  kept: readonly KeptPiece[];
  units: readonly QueueUnit[];
}): Map<string, StudyPortion[]> {
  const cumulative = getCumulativeCapacity(days);

  return listKeptIntervals({ cumulative, days, kept, units }).reduce((portions, interval) => {
    if (interval.kind === "boss" || interval.end <= interval.start) {
      return portions;
    }

    const { end, start } = interval;

    const own = listIntervalPortions({ cumulative, days, end, start }).flatMap((portion) => {
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

    return portions.set(interval.key, [...(portions.get(interval.key) ?? []), ...own]);
  }, new Map<string, StudyPortion[]>());
}

/** This week's kept lessons' time day by day, as the run lays them out with the rest. */
function listLaidPortions(own: readonly ScheduledUnit[]): Map<string, StudyPortion[]> {
  return own.reduce(
    (portions, unit) =>
      unit.studyPortions
        ? portions.set(unit.key, [...(portions.get(unit.key) ?? []), ...unit.studyPortions])
        : portions,
    new Map<string, StudyPortion[]>(),
  );
}

/** The day the time this week's kept work takes past it ends, from the week after's first day. */
function getSpillEnd({ days, minutes }: { days: readonly PlanDay[]; minutes: number }) {
  if (minutes <= 0) {
    return null;
  }

  const index = findDayIndex({ cumulative: getCumulativeCapacity(days), needed: minutes });
  return (days[index] ?? days.at(-1))?.date ?? null;
}

/** Whether a unit is a stand-in, a skill not outlined yet planned as one unit or in parts. */
function isStandIn(unit: QueueUnit): boolean {
  return unit.kind === "lesson" && unit.lessonId === null && unit.skillId !== null;
}

/**
 * An automatic run lays this week's kept work out with the rest, from today, as the run that saved
 * it did, and nothing new comes into this week (see `keepThisWeek`). When the run would date new
 * work this week (the rest takes less time than planned, as at a session's pace), it lays the rest
 * out again from the week after, after the time this week's work takes past it as the plan has it,
 * so no day gets more than it holds. Moved to the week's first day as it was, six new lessons of a
 * class test filled the day before the test, a review. Read from the run's own layout, which put
 * this week's work in another order, that time held an IELTS plan's next stand-ins a day later. A
 * run does that too when it would begin work the plan saved for this week past it: laid again
 * from today, a class test's two lessons saved for Thursday, which used time earlier days left,
 * ran into Monday and cut Monday's lesson on a refresh. `keptUntil` is the day a stand-in this
 * week began ends past its day, where the plan's lessons end at the latest (see
 * `getLastLessonDate`), `spill` the time this week's kept work takes past it (none when the run
 * keeps this week as it lays it out), and `keptParts` this week's kept work as the first layout
 * laid it when the run lays the rest out again (see `putLandedLessons`).
 */
export function layOutAfterThisWeek<T extends LaidOut>({
  days,
  kept,
  layOut,
  start,
  units,
}: {
  days: readonly PlanDay[];
  /** This week's kept work and the days it's saved for (see `listThisWeekWork`). */
  kept: readonly KeptPiece[];
  layOut: (laid: { days: readonly PlanDay[]; units: readonly QueueUnit[] }) => T;
  /** The first day new work can come in (see `keepThisWeek`). */
  start: Date;
  units: readonly QueueUnit[];
}): T & {
  keptParts: ScheduledUnit[];
  /** This week's kept lessons' time day by day (see `listKeptPortions`). */
  keptPortions: Map<string, StudyPortion[]>;
  keptUntil: Date | null;
  spill: number;
} {
  const thisWeek = new Set(kept.map((piece) => piece.key));
  const saved = new Set(kept.flatMap((piece) => (piece.saved ? [piece.key] : [])));
  const first = layOut({ days, units });
  const scheduled = [...first.carriedSchedule.units, ...first.restSchedule.units];
  const own = scheduled.filter((unit) => thisWeek.has(unit.key));

  // New work comes only after this week, and what the plan saved for it begins in it: only a
  // stand-in's later parts run on past it. Lessons that landed in a stand-in's place since keep
  // the stand-in's time whatever the run's copies of them do (see `putLandedLessons`).
  const begins = own.filter(
    (unit, index) =>
      saved.has(unit.key) && own.findIndex((part) => part.key === unit.key) === index,
  );

  const keepsThisWeek =
    scheduled.every((unit) => thisWeek.has(unit.key) || unit.date >= start) &&
    begins.every((unit) => unit.date < start);

  if (keepsThisWeek) {
    const parts = own.filter((unit) => isStandIn(unit));
    const last = Math.max(...parts.map((unit) => unit.date.getTime()));

    return {
      ...first,
      keptParts: [],
      keptPortions: listLaidPortions(own),
      keptUntil: parts.length > 0 ? new Date(last) : null,
      spill: 0,
    };
  }

  const after = days.filter((day) => day.date >= start);
  const spill = getTimePastThisWeek({ days, kept, start, units });

  return {
    ...layOut({
      days: reserveCarriedTime({ days: after, minutes: spill }),
      units: units.filter((unit) => !thisWeek.has(unit.key)),
    }),
    keptParts: own,
    keptPortions: listKeptPortions({ days, kept, units }),
    keptUntil: getSpillEnd({ days: after, minutes: spill }),
    spill,
  };
}
