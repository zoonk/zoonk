import { type QueueUnit } from "./plan-units";
import { type CycleContext, type CycleState, type Lane, isUnitReady } from "./study-cycle-lanes";

/** Floating-point sums of lesson minutes must not move a lesson to another day. */
export const EPSILON = 1e-6;

/**
 * Places the lane's next units that fit both its share of the day and what's left of the day,
 * and at least one when it fits the day, so a subject chosen for the day always gets its turn.
 * Returns the minutes placed.
 */
export function takeBlock({
  budget,
  context,
  dayEnd,
  lane,
  state,
}: {
  budget: number;
  context: CycleContext;
  dayEnd: number;
  lane: Lane;
  state: CycleState;
}): number {
  const take = (taken: number): number => {
    const unit = lane.units[0];

    if (
      !unit ||
      (taken > 0 && taken + unit.minutes > budget + EPSILON) ||
      state.used + unit.minutes > dayEnd + EPSILON ||
      !isUnitReady({ context, left: state.left, unit })
    ) {
      return taken;
    }

    placeUnit({ lane, state });
    return take(taken + unit.minutes);
  };

  return take(0);
}

export function placeUnit({
  lane,
  state,
}: {
  lane: Lane;
  state: CycleState;
}): QueueUnit | undefined {
  const unit = lane.units.shift();

  if (!unit) {
    return undefined;
  }

  // After whole days without lessons, the unit says where it starts: opening a day only skips
  // what's left of the day before.
  const opening = { opensDay: true, ...(state.skippedDay && { startsAt: state.used }) };

  state.placed.push(state.closedDay ? { ...unit, ...opening } : unit);
  state.closedDay = false;
  state.skippedDay = false;
  state.used += unit.minutes;

  if (unit.skillId && !unit.depth) {
    state.left.set(unit.skillId, (state.left.get(unit.skillId) ?? 1) - 1);
  }

  return unit;
}

/**
 * What the day's blocks left: the day's own subjects take it, and other subjects only when none
 * of the day's can go on (out of lessons, or waiting for a prerequisite). Returns the other
 * subjects that took part, the most due first.
 */
export function fillRest({
  chosen,
  context,
  dayEnd,
  state,
  taken,
}: {
  chosen: readonly Lane[];
  context: CycleContext;
  dayEnd: number;
  state: CycleState;
  taken: Map<Lane, number>;
}): Lane[] {
  const takeAll = (lane: Lane) => {
    const minutes = takeBlock({ budget: Infinity, context, dayEnd, lane, state });
    taken.set(lane, (taken.get(lane) ?? 0) + minutes);
  };

  chosen.forEach((lane) => takeAll(lane));

  const isStuck = chosen.every(
    (lane) =>
      lane.units.length === 0 || !isUnitReady({ context, left: state.left, unit: lane.units[0] }),
  );

  const others = isStuck
    ? state.lanes
        .filter((lane) => !chosen.includes(lane) && lane.units.length > 0)
        .toSorted((a, b) => a.pass - b.pass || a.order - b.order)
    : [];

  others.forEach((lane) => takeAll(lane));

  return others;
}

/**
 * When no subject can go on (a prerequisite cycle the graph normalizer missed), the most due
 * subject's next lesson goes anyway, and the day keeps filling around it instead of ending: a
 * cycle must not stall the plan, nor leave its days nearly empty. On a day nothing else went on,
 * that lesson goes even when it's longer than what's left of the day.
 */
export function forceStuckLessons({
  chosen,
  context,
  dayEnd,
  others,
  start,
  state,
  taken,
}: {
  chosen: readonly Lane[];
  context: CycleContext;
  dayEnd: number;
  others: Lane[];
  start: number;
  state: CycleState;
  taken: Map<Lane, number>;
}): void {
  const canGoOn = state.lanes.some(
    (open) =>
      open.units.length > 0 && isUnitReady({ context, left: state.left, unit: open.units[0] }),
  );

  const lane = [...chosen, ...others, ...state.lanes].find((open) => open.units.length > 0);
  const unit = lane?.units[0];
  const fits = state.used === start || state.used + (unit?.minutes ?? 0) <= dayEnd + EPSILON;

  // A day nothing went on still gets a lesson, as it always did; a day with lessons only fills up.
  if (
    (canGoOn && state.used !== start) ||
    !lane ||
    !unit ||
    state.used + EPSILON >= dayEnd ||
    !fits
  ) {
    return;
  }

  placeUnit({ lane, state });
  taken.set(lane, (taken.get(lane) ?? 0) + unit.minutes);

  const more = fillRest({ chosen: [lane, ...chosen], context, dayEnd, state, taken });
  others.push(...more.filter((other) => !others.includes(other)));

  forceStuckLessons({ chosen, context, dayEnd, others, start, state, taken });
}
