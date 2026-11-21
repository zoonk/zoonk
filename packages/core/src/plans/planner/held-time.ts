import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { type StudyPortion } from "./interval-study-minutes";
import { fromIsoDate } from "./plan-calendar";
import { isStandIn } from "./plan-item-rules";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { PLAN_EPSILON } from "./plan-precision";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, type ScheduledUnit } from "./schedule-units";

export type Held = { date: Date; index: number; minutes: number };

export type DayTime = { date: Date; minutes: number };

export type KeptTime = { date: Date; key: string; minutes: number };

/** A kept item takes the days it was saved on, as a lesson or stand-in that runs over several does. */
export function listKeptTime({
  frozen,
  units,
}: {
  frozen: readonly ExistingPlanItem[];
  units: ReadonlyMap<string, QueueUnit>;
}): KeptTime[] {
  return frozen.flatMap((item) => {
    const key = getItemKey(item);
    const unit = units.get(key);
    const days = readSelectedItemFacts(item.facts)?.days;

    if (!unit || !item.scheduledFor) {
      return [];
    }

    if (days) {
      return days.map(([date, , minutes]) => ({ date: fromIsoDate(date), key, minutes }));
    }

    return isStandIn(item) ? [] : [{ date: item.scheduledFor, key, minutes: unit.minutes }];
  });
}

export function sumByDay(units: readonly { date: Date; minutes: number }[]): Map<number, number> {
  return units.reduce(
    (sums, unit) =>
      sums.set(unit.date.getTime(), (sums.get(unit.date.getTime()) ?? 0) + unit.minutes),
    new Map<number, number>(),
  );
}

/** A unit that runs over several days takes its time on each of them. */
export function sumByPortionDay(
  units: readonly { date: Date; minutes: number; studyPortions?: readonly StudyPortion[] }[],
): Map<number, number> {
  return sumByDay(
    units.flatMap((unit) =>
      unit.studyPortions && unit.studyPortions.length > 0
        ? unit.studyPortions.map((portion) => ({
            date: fromIsoDate(portion.date),
            minutes: portion.lessonMinutes,
          }))
        : [unit],
    ),
  );
}

export function sumMinutes(held: readonly Held[]): number {
  return held.reduce((sum, piece) => sum + piece.minutes, 0);
}

export function listHeldTime({
  claimed,
  days,
  floor,
  free,
  laid,
  parts,
}: {
  claimed: Map<number, number>;
  days: readonly PlanDay[];
  floor?: Date;
  free: (date: Date) => number;
  laid: readonly ScheduledUnit[];
  parts: readonly number[];
}): Held[] {
  const held = parts.flatMap((index) => {
    const part = laid[index];

    if (!part) {
      return [];
    }

    const previous = laid[index - 1]?.date ?? days[0]?.date ?? part.date;
    const from = floor && floor > previous ? floor : previous;
    const span = days.filter((day) => day.date >= from && day.date <= part.date);

    const taken = span.reduce<{ held: Held[]; left: number }>(
      (state, day) => {
        const key = day.date.getTime();
        const room = Math.max(0, free(day.date) - (claimed.get(key) ?? 0));
        const minutes = Math.min(state.left, room);

        if (minutes <= PLAN_EPSILON) {
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

    return taken.left > PLAN_EPSILON
      ? [...taken.held, { date: part.date, index, minutes: taken.left }]
      : taken.held;
  });

  return held.toSorted((a, b) => a.date.getTime() - b.date.getTime() || a.index - b.index);
}

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
      const pieces = end - begin > PLAN_EPSILON ? [{ ...piece, minutes: end - begin }] : [];

      return { at: state.at + piece.minutes, pieces: [...state.pieces, ...pieces] };
    },
    { at: 0, pieces: [] },
  ).pieces;
}

export function findHeld(held: readonly Held[], at: number): Held | undefined {
  return held.find((_, index) => sumMinutes(held.slice(0, index + 1)) > at + PLAN_EPSILON);
}

/** Like the schedule, work starts in the first room it finds and goes on into the next. */
export function takeRoom({
  days,
  from,
  minutes,
  room,
}: {
  days: readonly PlanDay[];
  from: Date;
  minutes: number;
  room: (date: Date) => number;
}): DayTime[] {
  const { left, taken } = days.reduce<{ left: number; taken: DayTime[] }>(
    (state, { date }) => {
      const free = date < from || state.left <= PLAN_EPSILON ? 0 : room(date);

      if (free <= PLAN_EPSILON) {
        return state;
      }

      const used = Math.min(state.left, free);
      return { left: state.left - used, taken: [...state.taken, { date, minutes: used }] };
    },
    { left: minutes, taken: [] },
  );

  return left <= PLAN_EPSILON ? taken : [];
}
