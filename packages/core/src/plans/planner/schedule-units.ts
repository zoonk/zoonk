import { EPSILON, findDayIndex, findDayIndexFrom } from "./day-index";
import { type StudyPortion, getUnitStudy } from "./interval-study-minutes";
import { findLargestCount, makeRoomForOutcomes } from "./outcome-room";
import { addDays } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { type PlacedBoss, placeBoss, withKeptLessons } from "./whole-boss";

/** Something fixed to a date: a weekly checkpoint or mock, an exam phase checkpoint, a review day. */
export type FixedEvent = {
  /**
   * A phase's challenge right after the lessons it tests on their own day, with no study day left
   * after them (see `placeBoss`): it takes none of the day's time, all of its own past it.
   */
  beside?: boolean;
  key: string;
  kind: "boss" | "checkpoint" | "mock" | "review";
  /**
   * An exam's phase challenge on the first study day after the lessons it tests (see
   * `placeExamBosses`): it leads the day, and the day's lessons come after it.
   */
  leads?: boolean;
  minutes: number;
  /**
   * A scheduled exam mock: the exam day it sits, once the plan's mocks have their identities (see
   * `fundMocks`), and whether all of it, by its date's phase. Absent on other events and on a class
   * test's short mock, whose length its day sets.
   */
  mock?: { day?: number | null; fullLength: boolean };
  /**
   * The phase it belongs to when not its day's: a phase's challenge on the first study day after
   * its lessons, in the next phase's window, is still its own phase's.
   */
  ownPhase?: number;
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
   * Day minutes the day keeps for the teaching its window's challenge tests and the lesson the
   * learner was promised by it (see `getKeptMinutes`): no mock's funding takes them, and they stay
   * lesson time.
   */
  kept?: number;
  /**
   * Lesson minutes the day already gives to work an earlier day left (see `carryOver` in
   * `buildPlan`), so the rest of the plan fills only what's left of it.
   */
  reserved?: number;
  share: number;
};

export type ScheduledUnit = QueueUnit & {
  /** A phase's challenge right after its lessons on their own day (see `placeBoss`). */
  beside?: boolean;
  date: Date;
  studyMinutes: number;
  /** The day minutes a lesson takes on each of its days (see `getUnitStudy`); none for a boss. */
  studyPortions?: StudyPortion[];
  /**
   * The day the time it takes ends, when later than its date: a long lesson due on the plan's first
   * day teaches after it. Absent: its date.
   */
  teachingEnd?: Date;
};

/** A unit the plan can't cover, with the part of its minutes that still fits before the end. */
export type DroppedUnit = QueueUnit & { fittedMinutes: number };
export type ScheduledEvent = FixedEvent & { date: Date; phase: number | null };

/** One date of the plan with what it offers. */
export type PlanDay = { date: Date; shape: DayShape };

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

  const eventMinutes = shape.events
    .filter((event) => !event.beside)
    .reduce((total, event) => total + event.minutes, 0);

  const capacity = Math.max(0, shape.minutes - eventMinutes) * shape.share;

  return Math.max(0, capacity - (shape.reserved ?? 0));
}

/** Each day's lesson minutes added up from the first day: where in the plan's time a day ends. */
export function getCumulativeCapacity(days: readonly PlanDay[]): number[] {
  return days.reduce<number[]>((sums, day) => {
    sums.push((sums.at(-1) ?? 0) + getLessonCapacity(day));
    return sums;
  }, []);
}

/** Where a unit landed: its day, and where it starts in the plan's cumulative lesson minutes. */
type PlacedUnit = { beside?: boolean; dayIndex: number; start: number; unit: QueueUnit };

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
export function placeUnits(input: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): PlacedUnit[] {
  return layUnits(input).placed;
}

/** Where in the plan's lesson minutes the next unit after these starts at the earliest. */
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
    boss: PlacedBoss | null;
    dayIndex: number;
    placed: PlacedUnit[];
    used: number;
  }>(
    (state, unit) => {
      const boss = placeBoss({
        cumulative,
        from: state.dayIndex,
        previous: state.boss,
        unit,
        used: state.used,
      });

      if (boss) {
        state.placed.push({
          beside: boss.beside,
          dayIndex: boss.dayIndex,
          start: boss.start,
          unit,
        });

        return {
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

      // The next unit is looked for from a held challenge's day, even when its minutes run past it.
      const { heldOn } = unit;
      const next = heldOn !== undefined && (found === -1 || found > heldOn) ? heldOn : found;

      return { boss: null, dayIndex: next, placed: state.placed, used: needed };
    },
    { boss: null, dayIndex: 0, placed: [], used: 0 },
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

/** The units laid on these days with room made for the goal's outcomes (see `makeRoomForOutcomes`). */
export function makeOutcomeRoom({
  cumulative,
  placed,
  units,
}: {
  cumulative: readonly number[];
  /** This call's original placements, before any outcome cut changes the unit list. */
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

    /** Exam phases are time windows: a lesson belongs to the phase of the day it's due. */
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
