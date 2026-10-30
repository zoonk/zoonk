import { findDayIndex, findDayIndexFrom } from "./day-index";
import { type StudyPortion, getUnitStudy } from "./interval-study-minutes";
import { findLargestCount, makeRoomForOutcomes } from "./outcome-room";
import { addDays } from "./plan-calendar";
import { PLAN_EPSILON } from "./plan-precision";
import { type QueueUnit } from "./plan-units";
import { type PlacedBoss, placeBoss, withKeptLessons } from "./whole-boss";

export type FixedEvent = {
  beside?: boolean;
  key: string;
  kind: "boss" | "checkpoint" | "mock" | "review";
  leads?: boolean;
  minutes: number;
  mock?: { day?: number | null; fullLength: boolean };
  ownPhase?: number;
  replacesDay: boolean;
  title: string;
};

export type DayShape = {
  events: FixedEvent[];
  minutes: number;
  open: boolean;
  phase: number | null;
  kept?: number;
  reserved?: number;
  share: number;
};

export type ScheduledUnit = QueueUnit & {
  beside?: boolean;
  date: Date;
  studyMinutes: number;
  studyPortions?: StudyPortion[];
  teachingEnd?: Date;
};

export type DroppedUnit = QueueUnit & { fittedMinutes: number };
export type ScheduledEvent = FixedEvent & { date: Date; phase: number | null };

export type PlanDay = { date: Date; shape: DayShape };

export function listPlanDays({
  describeDay,
  horizonDays,
  start,
}: {
  describeDay: (date: Date) => DayShape;
  horizonDays: number;
  start: Date;
}): PlanDay[] {
  return Array.from({ length: Math.max(0, horizonDays) }, (_, offset) => {
    const date = addDays(start, offset);
    return { date, shape: describeDay(date) };
  });
}

export function getLessonCapacity({ shape }: PlanDay): number {
  if (!shape.open || shape.events.some((event) => event.replacesDay)) {
    return 0;
  }

  const eventMinutes = shape.events
    .filter((event) => !event.beside)
    .reduce((total, event) => total + event.minutes, 0);

  const capacity = Math.max(0, shape.minutes - eventMinutes) * shape.share;

  return Math.max(0, capacity - (shape.reserved ?? 0));
}

export function getCumulativeCapacity(days: readonly PlanDay[]): number[] {
  return days.reduce<number[]>((sums, day) => {
    sums.push((sums.at(-1) ?? 0) + getLessonCapacity(day));
    return sums;
  }, []);
}

type PlacedUnit = { beside?: boolean; dayIndex: number; start: number; unit: QueueUnit };

function getDayEnd({ cumulative, used }: { cumulative: readonly number[]; used: number }) {
  if (used <= PLAN_EPSILON) {
    return used;
  }

  return Math.max(used, cumulative[findDayIndex({ cumulative, needed: used })] ?? used);
}

function isOneLesson(unit: QueueUnit): boolean {
  return unit.kind === "lesson" && (unit.lessonId !== null || (unit.lessons ?? 1) <= 1);
}

function getDueDay({
  cumulative,
  dayIndex,
  first,
  start,
  unit,
}: {
  cumulative: readonly number[];
  dayIndex: number;
  first: boolean;
  start: number;
  unit: QueueUnit;
}): number {
  const startsDayOne = first && start + PLAN_EPSILON < (cumulative[0] ?? 0);

  if (!startsDayOne || dayIndex === 0) {
    return dayIndex;
  }

  return dayIndex > 0 || isOneLesson(unit) ? 0 : dayIndex;
}

export function placeUnits(input: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): PlacedUnit[] {
  return layUnits(input).placed;
}

export function getUsedAfterUnits(input: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): number {
  return layUnits(input).used;
}

function layUnits({
  cumulative,
  units,
}: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}) {
  return units.reduce<{
    besideDays: Set<number>;
    boss: PlacedBoss | null;
    dayIndex: number;
    placed: PlacedUnit[];
    used: number;
  }>(
    (state, unit) => {
      const placedBoss = placeBoss({
        cumulative,
        from: state.dayIndex,
        previous: state.boss,
        unit,
        used: state.used,
      });

      // A day runs past the learner's time by one challenge at most; another has no room.
      const boss =
        placedBoss?.beside && state.besideDays.has(placedBoss.dayIndex)
          ? { ...placedBoss, dayIndex: -1 }
          : placedBoss;

      if (boss) {
        if (boss.beside && boss.dayIndex >= 0) {
          state.besideDays.add(boss.dayIndex);
        }

        state.placed.push({
          beside: boss.beside,
          dayIndex: boss.dayIndex,
          start: boss.start,
          unit,
        });

        return {
          besideDays: state.besideDays,
          boss,
          dayIndex: Math.max(state.dayIndex, boss.dayIndex),
          placed: state.placed,
          used: boss.used,
        };
      }

      const start = Math.max(
        unit.startsAt ?? 0,
        unit.opensDay ? getDayEnd({ cumulative, used: state.used }) : state.used,
      );

      const needed = start + unit.minutes;
      const found = findDayIndexFrom({ cumulative, from: state.dayIndex, needed });
      const first = state.placed.length === 0;

      state.placed.push({
        dayIndex: unit.heldOn ?? getDueDay({ cumulative, dayIndex: found, first, start, unit }),
        start,
        unit,
      });

      const { heldOn } = unit;
      const next = heldOn !== undefined && (found === -1 || found > heldOn) ? heldOn : found;

      return {
        besideDays: state.besideDays,
        boss: null,
        dayIndex: next,
        placed: state.placed,
        used: needed,
      };
    },
    { besideDays: new Set(), boss: null, dayIndex: 0, placed: [], used: 0 },
  );
}

function fitsWhole({
  cumulative,
  units,
}: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): boolean {
  return placeUnits({ cumulative, units }).every(({ dayIndex }) => dayIndex >= 0);
}

function closeWhatFits({
  cumulative,
  placed,
  units,
}: {
  cumulative: readonly number[];
  placed: readonly PlacedUnit[];
  units: readonly QueueUnit[];
}): { kept: QueueUnit[]; leftOut: QueueUnit[] } {
  const closing = units.at(-1);
  const before = units.slice(0, -1);
  const unchanged = { kept: [...units], leftOut: [] };

  if (closing?.kind !== "boss" || placed.every(({ dayIndex }) => dayIndex >= 0)) {
    return unchanged;
  }

  const fitting = placed.slice(0, -1).filter(({ dayIndex }) => dayIndex >= 0);

  const count = findLargestCount({
    high: fitting.length,
    low: 0,
    works: (fitted) => fitsWhole({ cumulative, units: [...before.slice(0, fitted), closing] }),
  });

  if (count === null) {
    return unchanged;
  }

  const kept = before.slice(0, count);
  const reachesPhase = kept.some((unit) => unit.kind === "lesson" && unit.phase === closing.phase);
  const takesOnlyDepth = before.slice(count, fitting.length).every((unit) => unit.depth);

  return reachesPhase && takesOnlyDepth
    ? { kept: [...kept, closing], leftOut: before.slice(count) }
    : unchanged;
}

export function makeOutcomeRoom({
  cumulative,
  placed,
  units,
}: {
  cumulative: readonly number[];
  placed?: readonly PlacedUnit[];
  units: readonly QueueUnit[];
}) {
  return makeRoomForOutcomes({
    dropsOutcome: (list) =>
      (list === units && placed ? placed : placeUnits({ cumulative, units: list })).some(
        ({ dayIndex, unit }) => dayIndex < 0 && unit.outcome && !unit.depth,
      ),
    units,
  });
}

export function scheduleUnits({
  days,
  units: given,
}: {
  days: readonly PlanDay[];
  units: readonly QueueUnit[];
}): { dropped: DroppedUnit[]; events: ScheduledEvent[]; units: ScheduledUnit[] } {
  const cumulative = getCumulativeCapacity(days);
  const capacity = cumulative.at(-1) ?? 0;
  const units = withKeptLessons({ days, units: given });

  const initial = placeUnits({ cumulative, units });
  const room = makeOutcomeRoom({ cumulative, placed: initial, units });

  const roomPlaced =
    room.leftOut.length > 0 ? placeUnits({ cumulative, units: room.kept }) : initial;

  const closed = closeWhatFits({ cumulative, placed: roomPlaced, units: room.kept });
  const { kept } = closed;
  const leftOut = [...room.leftOut, ...closed.leftOut];
  const placed = closed.leftOut.length > 0 ? placeUnits({ cumulative, units: kept }) : roomPlaced;

  const scheduled = placed.flatMap(({ beside, dayIndex, start, unit }) => {
    const day = days[dayIndex];

    if (!day || dayIndex < 0) {
      return [];
    }

    const endDay = Math.max(dayIndex, findDayIndex({ cumulative, needed: start + unit.minutes }));
    const teachingEnd = unit.kind === "boss" ? day.date : (days[endDay]?.date ?? day.date);

    const { studyMinutes, studyPortions } = getUnitStudy({
      cumulative,
      days,
      dueDate: day.date,
      overflowShare: day.shape.share,
      start,
      unit,
    });

    return [
      {
        ...unit,
        ...(beside ? { beside } : {}),
        date: day.date,
        phase: day.shape.phase ?? unit.phase,
        studyMinutes,
        ...(studyPortions.length > 0 ? { studyPortions } : {}),
        ...(teachingEnd > day.date ? { teachingEnd } : {}),
      },
    ];
  });

  const events = days.flatMap((day) =>
    day.shape.events.map((event) => ({
      ...event,
      date: day.date,
      phase: event.ownPhase ?? day.shape.phase,
    })),
  );

  return {
    dropped: [
      ...leftOut.map((unit) => ({ ...unit, fittedMinutes: 0 })),
      ...placed
        .filter(({ dayIndex }) => dayIndex < 0)
        .map(({ start, unit }) => ({
          ...unit,
          fittedMinutes: Math.min(unit.minutes, Math.max(0, capacity - start)),
        })),
    ],
    events,
    units: scheduled,
  };
}
