import { type PlanDay, type ScheduledUnit } from "./schedule-units";

/** Floating-point sums of lesson minutes must not move a lesson to another day. */
export const EPSILON = 1e-6;

/** Time a landed skill's stand-in held on a day, and the part of it (by its place) that held it. */
export type Held = { date: Date; index: number; minutes: number };

/** Each day's lesson minutes among units. */
export function sumByDay(units: readonly { date: Date; minutes: number }[]): Map<number, number> {
  return units.reduce(
    (sums, unit) =>
      sums.set(unit.date.getTime(), (sums.get(unit.date.getTime()) ?? 0) + unit.minutes),
    new Map<number, number>(),
  );
}

/** The minutes of a skill's held pieces, all together. */
export function sumMinutes(held: readonly Held[]): number {
  return held.reduce((sum, piece) => sum + piece.minutes, 0);
}

/**
 * The time each part of a landed skill's stand-in held: its day's free time, then the free time of
 * the days before it, back to the day of the unit laid before it. A stand-in laid whole is due on
 * the day its time ends: a learn plan's ran from Wednesday to the next Monday, its item on Monday.
 */
export function listHeldTime({
  claimed,
  days,
  free,
  laid,
  parts,
}: {
  /** The free time days already gave parts, which no other part takes. */
  claimed: Map<number, number>;
  days: readonly PlanDay[];
  free: (date: Date) => number;
  laid: readonly ScheduledUnit[];
  parts: readonly number[];
}): Held[] {
  const held = parts.flatMap((index) => {
    const part = laid[index];

    if (!part) {
      return [];
    }

    const floor = laid[index - 1]?.date ?? days[0]?.date ?? part.date;
    const back = days.filter((day) => day.date >= floor && day.date <= part.date).toReversed();

    const taken = back.reduce<{ held: Held[]; left: number }>(
      (state, day) => {
        const key = day.date.getTime();
        const room = Math.max(0, free(day.date) - (claimed.get(key) ?? 0));
        const minutes = Math.min(state.left, room);

        if (minutes <= EPSILON) {
          return state;
        }

        claimed.set(key, (claimed.get(key) ?? 0) + minutes);

        return {
          held: [...state.held, { date: day.date, index, minutes }],
          left: state.left - minutes,
        };
      },
      { held: [], left: part.minutes },
    );

    // What no day before it had free for it stays on its own day, as the run laid it.
    return taken.left > EPSILON
      ? [...taken.held, { date: part.date, index, minutes: taken.left }]
      : taken.held;
  });

  return held.toSorted((a, b) => a.date.getTime() - b.date.getTime() || a.index - b.index);
}

/** The held time from `from` on, `minutes` of it, as pieces on its days. */
export function listHeldFrom({
  from,
  held,
  minutes,
}: {
  from: number;
  held: readonly Held[];
  minutes: number;
}): Held[] {
  return held.reduce<{ at: number; pieces: Held[] }>(
    (state, piece) => {
      const begin = Math.max(state.at, from);
      const end = Math.min(state.at + piece.minutes, from + minutes);
      const pieces = end - begin > EPSILON ? [{ ...piece, minutes: end - begin }] : [];

      return { at: state.at + piece.minutes, pieces: [...state.pieces, ...pieces] };
    },
    { at: 0, pieces: [] },
  ).pieces;
}

/** The held piece a point of a skill's held time falls in. */
export function findHeld(held: readonly Held[], at: number): Held | undefined {
  return held.find((_, index) => sumMinutes(held.slice(0, index + 1)) > at + EPSILON);
}
