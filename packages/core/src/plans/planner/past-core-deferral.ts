import { isPastCore } from "./core-first";
import { findLargestCount } from "./outcome-room";
import { LEARN_KINDS } from "./plan-item-rules";
import { PLAN_EPSILON } from "./plan-precision";
import { type QueueUnit } from "./plan-units";
import { placeUnits } from "./schedule-units";

export function findLate({
  cumulative,
  start,
  units,
}: {
  cumulative: readonly number[];
  start: number;
  units: readonly QueueUnit[];
}): number {
  return placeUnits({ cumulative, units }).findIndex(
    ({ dayIndex, start: unitStart, unit }) =>
      dayIndex < 0 || unitStart + unit.minutes > start + PLAN_EPSILON,
  );
}

export function hasLateLesson({
  late,
  units,
}: {
  late: number;
  units: readonly QueueUnit[];
}): boolean {
  return late !== -1 && units.slice(late).some((unit) => LEARN_KINDS.has(unit.kind));
}

/**
 * Moves the fewest lessons past their core (the last ones) after a held challenge, so the lessons
 * it waits for end by its day; null when they don't.
 */
export function deferPastCore({
  before,
  cumulative,
  start,
}: {
  before: readonly QueueUnit[];
  cumulative: readonly number[];
  start: number;
}): { kept: QueueUnit[]; moved: QueueUnit[] } | null {
  const pastCore = before.filter((unit) => unit.kind === "lesson" && isPastCore(unit));

  const keeping = (count: number) => {
    const moved = new Set(pastCore.slice(count));
    return before.filter((unit) => !moved.has(unit));
  };

  const count = findLargestCount({
    high: pastCore.length - 1,
    low: 0,
    works: (kept) => {
      const units = keeping(kept);
      return !hasLateLesson({ late: findLate({ cumulative, start, units }), units });
    },
  });

  return count === null ? null : { kept: keeping(count), moved: pastCore.slice(count) };
}
