import { type QueueUnit } from "./plan-units";
import { getLessonCapacity } from "./schedule-units";
import { EPSILON, takeBlock } from "./study-cycle-blocks";
import {
  type CadencedArea,
  type CadencedLane,
  type CycleContext,
  type CycleState,
  orderOwnPrerequisites,
  pullPrerequisites,
} from "./study-cycle-lanes";

/** Lesson minutes of the open days from each day to the plan's last. */
function getOpenLeft({
  context,
  openDays,
}: {
  context: CycleContext;
  openDays: ReadonlySet<number>;
}): number[] {
  return context.days
    .map((day, index) => (openDays.has(index) ? getLessonCapacity(day) : 0))
    .toReversed()
    .reduce<number[]>((sums, capacity) => {
      sums.push((sums.at(-1) ?? 0) + capacity);
      return sums;
    }, [])
    .toReversed();
}

/**
 * One lane per area practiced on days of its own, with all its units in teaching order (cores
 * before depth, as the queue has them), across the cycle's parts: its days don't follow the
 * rotation's parts.
 */
export function toCadencedLanes({
  cadenced,
  context,
  units,
}: {
  cadenced: ReadonlyMap<string, CadencedArea>;
  context: CycleContext;
  units: readonly QueueUnit[];
}): CadencedLane[] {
  return [...cadenced].flatMap(([area, { minutes, openDays }]) => {
    const own = units.filter((unit) => unit.area === area);

    if (own.length === 0) {
      return [];
    }

    return [
      {
        area,
        joinDay: 0,
        openDays,
        openLeft: getOpenLeft({ context, openDays }),
        order: 0,
        pass: 0,
        quota: minutes,
        rate: 1,
        units: orderOwnPrerequisites({ prerequisites: context.prerequisites, units: own }),
      },
    ];
  });
}

/** Whether an area practiced on days of its own still has lessons and minutes to place. */
export function hasCadencedLeft(lane: CadencedLane): boolean {
  return lane.units.length > 0 && lane.quota > EPSILON;
}

/** The areas practiced on days of their own that this day is one of, with lessons left to place. */
export function listOpenCadenced({
  dayIndex,
  state,
}: {
  dayIndex: number;
  state: CycleState;
}): CadencedLane[] {
  return state.cadenced.filter((lane) => lane.openDays.has(dayIndex) && hasCadencedLeft(lane));
}

/**
 * Each open area's block of the day, before the rotation's: its even part of the minutes it has
 * left over the days it has left, at least one lesson (as any subject chosen for a day), so a
 * day a lesson didn't fit evens out on the next. What it builds on in other subjects comes first
 * in theirs.
 */
export function takeCadencedBlocks({
  context,
  dayEnd,
  dayIndex,
  lanes,
  state,
}: {
  context: CycleContext;
  dayEnd: number;
  dayIndex: number;
  lanes: readonly CadencedLane[];
  state: CycleState;
}): void {
  const room = dayEnd - state.used;

  lanes.forEach((lane) => {
    pullPrerequisites({ context, lane, lanes: [...state.lanes, lane], left: state.left });

    const share = Math.min(1, lane.quota / Math.max(lane.openLeft[dayIndex] ?? 0, EPSILON));
    lane.quota -= takeBlock({ budget: room * share, context, dayEnd, lane, state });
  });
}
