import { type QueueUnit } from "./plan-units";
import { type CycleContext, type CycleState, type Lane, isUnitReady } from "./study-cycle-lanes";

export const EPSILON = 1e-6;

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
  const isReady = (open: Lane) =>
    open.units.length > 0 && isUnitReady({ context, left: state.left, unit: open.units[0] });

  const canGoOn = state.lanes.some((open) => isReady(open));
  const lanes = [...chosen, ...others, ...state.lanes];

  const lane = lanes.find((open) => isReady(open)) ?? lanes.find((open) => open.units.length > 0);
  const unit = lane?.units[0];
  const fits = state.used === start || state.used + (unit?.minutes ?? 0) <= dayEnd + EPSILON;

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

export function appendRest({
  context,
  lanes,
  state,
}: {
  context: CycleContext;
  lanes: readonly Lane[];
  state: CycleState;
}): void {
  const take = (lane: Lane) => {
    const unit = lane.units.shift();

    if (unit) {
      state.placed.push(unit);

      if (unit.skillId && !unit.depth) {
        state.left.set(unit.skillId, (state.left.get(unit.skillId) ?? 1) - 1);
      }
    }
  };

  let open = lanes.filter((lane) => lane.units.length > 0);

  while (open.length > 0) {
    const ready = open.filter((lane) =>
      isUnitReady({ context, left: state.left, unit: lane.units[0] }),
    );

    // Subjects whose next lessons wait on each other must not stall the plan.
    (ready.length > 0 ? ready : open.slice(0, 1)).forEach((lane) => take(lane));
    open = open.filter((lane) => lane.units.length > 0);
  }
}
