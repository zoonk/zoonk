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

type KeptInterval = { end: number; key: string; kind: QueueUnit["kind"]; start: number };

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

function listLaidPortions(own: readonly ScheduledUnit[]): Map<string, StudyPortion[]> {
  return own.reduce(
    (portions, unit) =>
      unit.studyPortions
        ? portions.set(unit.key, [...(portions.get(unit.key) ?? []), ...unit.studyPortions])
        : portions,
    new Map<string, StudyPortion[]>(),
  );
}

function getSpillEnd({ days, minutes }: { days: readonly PlanDay[]; minutes: number }) {
  if (minutes <= 0) {
    return null;
  }

  const index = findDayIndex({ cumulative: getCumulativeCapacity(days), needed: minutes });
  return (days[index] ?? days.at(-1))?.date ?? null;
}

function isStandIn(unit: QueueUnit): boolean {
  return unit.kind === "lesson" && unit.lessonId === null && unit.skillId !== null;
}

export function layOutAfterThisWeek<T extends LaidOut>({
  days,
  kept,
  layOut,
  start,
  units,
}: {
  days: readonly PlanDay[];
  kept: readonly KeptPiece[];
  layOut: (laid: { days: readonly PlanDay[]; units: readonly QueueUnit[] }) => T;
  start: Date;
  units: readonly QueueUnit[];
}): T & {
  keptParts: ScheduledUnit[];
  keptPortions: Map<string, StudyPortion[]>;
  keptUntil: Date | null;
  spill: number;
} {
  const thisWeek = new Set(kept.map((piece) => piece.key));
  const saved = new Set(kept.flatMap((piece) => (piece.saved ? [piece.key] : [])));
  const first = layOut({ days, units });
  const scheduled = [...first.carriedSchedule.units, ...first.restSchedule.units];
  const own = scheduled.filter((unit) => thisWeek.has(unit.key));

  const begins = own.filter(
    (unit, index) =>
      saved.has(unit.key) && own.findIndex((part) => part.key === unit.key) === index,
  );

  const keepsThisWeek =
    scheduled.every((unit) => thisWeek.has(unit.key) || unit.date >= start) &&
    begins.every((unit) => unit.date < start);

  const invertsSkill = scheduled.some((unit) => {
    if (!isStandIn(unit)) {
      return false;
    }

    const lesson = own.find((part) => part.skillId === unit.skillId && part.lessonId !== null);
    const firstKept = kept.find((piece) => piece.key === lesson?.key);

    return (
      firstKept !== undefined &&
      unit.studyPortions?.some((part) => part.date < toIsoDate(firstKept.date)) === true
    );
  });

  if (keepsThisWeek && !invertsSkill) {
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
