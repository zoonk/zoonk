import { findLargestCount, makeRoomForOutcomes } from "./outcome-room";
import { addDays } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";

/** Something fixed to a date: a weekly checkpoint or mock, an exam phase checkpoint, a review day. */
export type FixedEvent = {
  key: string;
  kind: "boss" | "checkpoint" | "mock" | "review";
  minutes: number;
  /** A mock exam takes the whole day: no lessons that day. */
  replacesDay: boolean;
  title: string;
};

/** What one day offers: study minutes, the share that goes to new lessons, and fixed events. */
export type DayShape = {
  events: FixedEvent[];
  minutes: number;
  /** Whether new lessons may go on this day: false in an exam's final stretch and after a deadline. */
  open: boolean;
  /** The plan phase the day belongs to, or null when phases follow the lessons (learn plans). */
  phase: number | null;
  /**
   * Lesson minutes the day already gives to work an earlier day left (see `carryOver` in
   * `buildPlan`), so the rest of the plan fills only what's left of it.
   */
  reserved?: number;
  share: number;
};

export type ScheduledUnit = QueueUnit & { date: Date; studyMinutes: number };

/** A unit the plan can't cover, with the part of its minutes that still fits before the end. */
export type DroppedUnit = QueueUnit & { fittedMinutes: number };
export type ScheduledEvent = FixedEvent & { date: Date; phase: number | null };

/** One date of the plan with what it offers. */
export type PlanDay = { date: Date; shape: DayShape };

/** Floating-point sums of lesson minutes must not push a lesson to the next day. */
const EPSILON = 1e-6;

/** The plan's dates from its start, each with what it offers, up to its horizon. */
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

/**
 * The minutes a day gives new lessons: its time minus fixed events, times its learning share, less
 * what work an earlier day left already takes of it.
 */
export function getLessonCapacity({ shape }: PlanDay): number {
  if (!shape.open || shape.events.some((event) => event.replacesDay)) {
    return 0;
  }

  const eventMinutes = shape.events.reduce((total, event) => total + event.minutes, 0);
  const capacity = Math.max(0, shape.minutes - eventMinutes) * shape.share;

  return Math.max(0, capacity - (shape.reserved ?? 0));
}

function prefixSums(values: readonly number[]): number[] {
  return values.reduce<number[]>((sums, value) => {
    sums.push((sums.at(-1) ?? 0) + value);
    return sums;
  }, []);
}

/** Each day's lesson minutes added up from the first day: where in the plan's time a day ends. */
export function getCumulativeCapacity(days: readonly PlanDay[]): number[] {
  return prefixSums(days.map((day) => getLessonCapacity(day)));
}

/** The first day whose cumulative capacity reaches `needed`, or -1 when none does. */
export function findDayIndex({
  cumulative,
  needed,
}: {
  cumulative: readonly number[];
  needed: number;
}) {
  const search = (low: number, high: number): number => {
    if (low >= high) {
      return (cumulative[low] ?? 0) + EPSILON >= needed ? low : -1;
    }

    const middle = Math.floor((low + high) / 2);

    return (cumulative[middle] ?? 0) + EPSILON >= needed
      ? search(low, middle)
      : search(middle + 1, high);
  };

  return cumulative.length === 0 ? -1 : search(0, cumulative.length - 1);
}

/**
 * `findDayIndex` for a unit placed after the one that landed on day `from`: what it needs only
 * grows, so no day before `from` reaches it. The search gallops from there (a step, then twice as
 * many) instead of searching every day for each unit: a real-size exam places thousands of units,
 * many times per plan, and each lands on or near the day before it.
 */
function findDayIndexFrom({
  cumulative,
  from,
  needed,
}: {
  cumulative: readonly number[];
  from: number;
  needed: number;
}): number {
  const last = cumulative.length - 1;

  if (from < 0 || from > last) {
    return -1;
  }

  const reaches = (day: number) => (cumulative[day] ?? 0) + EPSILON >= needed;

  const search = (low: number, high: number): number => {
    if (low >= high) {
      return low;
    }

    const middle = Math.floor((low + high) / 2);
    return reaches(middle) ? search(low, middle) : search(middle + 1, high);
  };

  const gallop = (low: number, step: number): number => {
    const high = Math.min(last, low + step - 1);

    if (reaches(high)) {
      return search(low, high);
    }

    return high === last ? -1 : gallop(high + 1, step * 2);
  };

  return gallop(from, 1);
}

/** Where a unit landed: its day, and where it starts in the plan's cumulative lesson minutes. */
type PlacedUnit = { dayIndex: number; start: number; unit: QueueUnit };

/**
 * Where in the plan's lesson minutes the next unit starts after one that ends at `needed`, on a
 * day that ends at `dayEnd`: a phase checkpoint closes its day, and a kept phase end's challenge
 * (`heldOn`) takes only its own day's time, even past it (a day the learner rests, or two
 * challenges a half-studied day left on it), so the next day keeps its lessons.
 */
export function getUsedAfter({
  dayEnd,
  needed,
  unit,
}: {
  dayEnd: number | undefined;
  needed: number;
  unit: QueueUnit;
}): number {
  if (dayEnd === undefined || unit.kind !== "boss") {
    return needed;
  }

  return unit.heldOn === undefined ? Math.max(needed, dayEnd) : dayEnd;
}

/**
 * Where the day that `used` reaches into ends: `used` itself when it ends a day, as nothing used
 * yet ends the day before the first.
 */
function getDayEnd({ cumulative, used }: { cumulative: readonly number[]; used: number }) {
  if (used <= EPSILON) {
    return used;
  }

  return Math.max(used, cumulative[findDayIndex({ cumulative, needed: used })] ?? used);
}

/** A lesson, or a stand-in's part as long as one. */
function isOneLesson(unit: QueueUnit): boolean {
  return unit.kind === "lesson" && (unit.lessonId !== null || (unit.lessons ?? 1) <= 1);
}

/**
 * The day a unit is due (see `placeUnits`), except that the first unit, when it starts on the
 * plan's first day, is due on it even though it runs into the next, and so is a first lesson the
 * plan's time doesn't cover at all: day one always has a session, and at a few minutes a day every
 * lesson is longer than a day's lesson time, while a test two days away has time for less than one.
 */
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
  const startsDayOne = first && start + EPSILON < (cumulative[0] ?? 0);

  if (!startsDayOne || dayIndex === 0) {
    return dayIndex;
  }

  return dayIndex > 0 || isOneLesson(unit) ? 0 : dayIndex;
}

/**
 * The day each unit is due: the first whose cumulative time covers it (the plan's first unit
 * aside; see `getDueDay`). A phase checkpoint closes its day, so the next phase starts fresh on
 * the day after, never in the middle of the one before, though a challenge right after it shares
 * its day (the one a half-studied day left, then the next phase's on the day it ends; see
 * `keepAfterEarlierChallenges`), and a kept phase end's challenge stays on its day (`heldOn`); a
 * unit that opens a study-cycle day does the same for the day before it, and one placed after days
 * the cycle left without lessons starts after them.
 */
export function placeUnits({
  cumulative,
  units,
}: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): PlacedUnit[] {
  return units.reduce<{
    bossEnd: number | null;
    dayIndex: number;
    placed: PlacedUnit[];
    used: number;
  }>(
    (state, unit) => {
      const from = unit.kind === "boss" && state.bossEnd !== null ? state.bossEnd : state.used;

      const start = Math.max(
        unit.startsAt ?? 0,
        unit.opensDay ? getDayEnd({ cumulative, used: from }) : from,
      );

      const needed = start + unit.minutes;
      const found = findDayIndexFrom({ cumulative, from: state.dayIndex, needed });
      const dayEnd = cumulative[unit.heldOn ?? found];

      const first = state.placed.length === 0;

      state.placed.push({
        dayIndex: unit.heldOn ?? getDueDay({ cumulative, dayIndex: found, first, start, unit }),
        start,
        unit,
      });

      // The next unit is looked for from a held challenge's day, even when its minutes run past it.
      const { heldOn } = unit;
      const next = heldOn !== undefined && (found === -1 || found > heldOn) ? heldOn : found;

      return {
        bossEnd: unit.kind === "boss" ? needed : null,
        dayIndex: next,
        placed: state.placed,
        used: getUsedAfter({ dayEnd, needed, unit }),
      };
    },
    { bossEnd: null, dayIndex: 0, placed: [], used: 0 },
  ).placed;
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

/**
 * The checkpoint that closes the plan (the final challenge, last in the queue) closes what the
 * plan's time fits: when the depth before it runs past the end (a plan short on time studies it
 * once every core is in), it comes right after the last unit it still fits after, taking the place
 * of depth only, and what comes after it is left out, instead of the plan losing its final
 * challenge with that depth. A plan whose last phase isn't reached, or whose challenge would take
 * a core or an outcome lesson's place, has none.
 */
function closeWhatFits({
  cumulative,
  units,
}: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): { kept: QueueUnit[]; leftOut: QueueUnit[] } {
  const closing = units.at(-1);
  const before = units.slice(0, -1);
  const unchanged = { kept: [...units], leftOut: [] };

  if (closing?.kind !== "boss" || fitsWhole({ cumulative, units })) {
    return unchanged;
  }

  const fitting = placeUnits({ cumulative, units: before }).filter(({ dayIndex }) => dayIndex >= 0);

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

/** The units laid on these days with room made for the goal's outcomes (see `makeRoomForOutcomes`). */
export function makeOutcomeRoom({
  cumulative,
  units,
}: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}) {
  return makeRoomForOutcomes({
    dropsOutcome: (list) =>
      placeUnits({ cumulative, units: list }).some(
        ({ dayIndex, unit }) => dayIndex < 0 && unit.outcome && !unit.depth,
      ),
    units,
  });
}

/**
 * Lays units on days in order. Each day gives new lessons its study minutes, minus fixed events,
 * times its learning share; a unit is due on the day the cumulative time covers it, so a long
 * placeholder spans several days. Units that don't fit before the horizon or the last open day
 * are dropped: the plan can't cover them at this pace. A dropped unit says how much of it would
 * still fit, so coverage reads the same whether a skill is one placeholder or its lessons. The
 * goal's outcome lessons (a career change's portfolio and job search; an exam's written test, its
 * core) are never the ones dropped while other lessons can make room for them (see
 * `makeRoomForOutcomes`), and the final challenge closes what fits (see `closeWhatFits`).
 */
export function scheduleUnits({
  days,
  units,
}: {
  days: readonly PlanDay[];
  units: readonly QueueUnit[];
}): { dropped: DroppedUnit[]; events: ScheduledEvent[]; units: ScheduledUnit[] } {
  const cumulative = getCumulativeCapacity(days);
  const capacity = cumulative.at(-1) ?? 0;

  const room = makeOutcomeRoom({ cumulative, units });
  const closed = closeWhatFits({ cumulative, units: room.kept });
  const { kept } = closed;
  const leftOut = [...room.leftOut, ...closed.leftOut];
  const placed = placeUnits({ cumulative, units: kept });

  const scheduled = placed.flatMap(({ dayIndex, unit }) => {
    const day = days[dayIndex];

    if (!day || dayIndex < 0) {
      return [];
    }

    /** Exam phases are time windows: a lesson belongs to the phase of the day it's due. */
    const phase = day.shape.phase ?? unit.phase;

    return [
      { ...unit, date: day.date, phase, studyMinutes: unit.minutes / (day.shape.share || 1) },
    ];
  });

  const events = days.flatMap((day) =>
    day.shape.events.map((event) => ({ ...event, date: day.date, phase: day.shape.phase })),
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
