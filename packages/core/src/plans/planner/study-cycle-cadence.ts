import { type QueueUnit } from "./plan-units";
import { getLessonCapacity } from "./schedule-units";
import { EPSILON, takeBlock } from "./study-cycle-blocks";
import { getDueMinutes } from "./study-cycle-budgets";
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
        dueUnits: own.filter((unit) => unit.dueBy),
        joinDay: 0,
        minutes,
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

/**
 * Whether an area practiced on days of its own has had less of its minutes than its days' lesson
 * time gone by gives it: on days shorter than a lesson, it's the subject most due.
 */
export function isCadencedBehind({
  dayIndex,
  lane,
}: {
  dayIndex: number;
  lane: CadencedLane;
}): boolean {
  const total = lane.openLeft[0] ?? 0;
  const gone = total - (lane.openLeft[dayIndex] ?? 0);

  return (lane.minutes - lane.quota) * total + EPSILON < lane.minutes * gone;
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
 * left over the days it has left, so a day a lesson didn't fit evens out on the next. A day whose
 * part is shorter than its next lesson has none of it, unless the area is behind its even spread
 * (see `isCadencedBehind`): then it takes one lesson. Taking one every day, at 10 minutes a day
 * the essay took every day's only lesson until its minutes ran out, and day one opened with it
 * instead of the learner's gaps. What it builds on in other subjects comes first in theirs. An area
 * holding the chapter in progress's next lesson takes at least the time to reach it by the day the
 * learner saw it on (`getDueMinutes`): "less essay" moved the essay chapter's next lesson a day.
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
    // The chapter in progress's next lesson keeps the day the learner saw (R10), as in the rotation.
    const due = getDueMinutes({ date: context.days[dayIndex]?.date, lane });
    const budget = Math.max(room * share, due);
    const head = lane.units[0];

    if (head && head.minutes > budget + EPSILON && !isCadencedBehind({ dayIndex, lane })) {
      return;
    }

    lane.quota -= takeBlock({ budget, context, dayEnd, lane, state });
  });
}
