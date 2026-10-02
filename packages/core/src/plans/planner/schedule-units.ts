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
  share: number;
};

export type ScheduledUnit = QueueUnit & { date: Date; studyMinutes: number };
export type ScheduledEvent = FixedEvent & { date: Date; phase: number | null };

type Day = { date: Date; shape: DayShape };

/** Floating-point sums of lesson minutes must not push a lesson to the next day. */
const EPSILON = 1e-6;

function getLessonCapacity({ shape }: Day): number {
  if (!shape.open || shape.events.some((event) => event.replacesDay)) {
    return 0;
  }

  const eventMinutes = shape.events.reduce((total, event) => total + event.minutes, 0);
  return Math.max(0, shape.minutes - eventMinutes) * shape.share;
}

function prefixSums(values: readonly number[]): number[] {
  return values.reduce<number[]>((sums, value) => {
    sums.push((sums.at(-1) ?? 0) + value);
    return sums;
  }, []);
}

/** The first day whose cumulative capacity reaches `needed`, or -1 when none does. */
function findDayIndex({ cumulative, needed }: { cumulative: readonly number[]; needed: number }) {
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

type PlacedUnit = { dayIndex: number; unit: QueueUnit };

/**
 * The day each unit is due: the first whose cumulative time covers it. A phase checkpoint closes
 * its day, so the next phase starts fresh on the day after, never in the middle of the one before.
 */
function placeUnits({
  cumulative,
  units,
}: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): PlacedUnit[] {
  return units.reduce<{ placed: PlacedUnit[]; used: number }>(
    (state, unit) => {
      const needed = state.used + unit.minutes;
      const dayIndex = findDayIndex({ cumulative, needed });
      const dayEnd = cumulative[dayIndex];

      state.placed.push({ dayIndex, unit });

      return {
        placed: state.placed,
        used: unit.kind === "boss" && dayEnd !== undefined ? Math.max(needed, dayEnd) : needed,
      };
    },
    { placed: [], used: 0 },
  ).placed;
}

/**
 * Lays units on days in order. Each day gives new lessons its study minutes, minus fixed events,
 * times its learning share; a unit is due on the day the cumulative time covers it, so a long
 * placeholder spans several days. Units that don't fit before the horizon or the last open day
 * are dropped: the plan can't cover them at this pace.
 */
export function scheduleUnits({
  describeDay,
  horizonDays,
  start,
  units,
}: {
  describeDay: (date: Date) => DayShape;
  horizonDays: number;
  start: Date;
  units: readonly QueueUnit[];
}): { dropped: QueueUnit[]; events: ScheduledEvent[]; units: ScheduledUnit[] } {
  const days: Day[] = Array.from({ length: Math.max(0, horizonDays) }, (_, offset) => {
    const date = addDays(start, offset);
    return { date, shape: describeDay(date) };
  });

  const cumulative = prefixSums(days.map((day) => getLessonCapacity(day)));
  const placed = placeUnits({ cumulative, units });

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
    dropped: placed.filter(({ dayIndex }) => dayIndex < 0).map(({ unit }) => unit),
    events,
    units: scheduled,
  };
}
