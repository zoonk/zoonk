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

export function hasCadencedLeft(lane: CadencedLane): boolean {
  return lane.units.length > 0 && lane.quota > EPSILON;
}

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

export function listOpenCadenced({
  dayIndex,
  state,
}: {
  dayIndex: number;
  state: CycleState;
}): CadencedLane[] {
  return state.cadenced.filter((lane) => lane.openDays.has(dayIndex) && hasCadencedLeft(lane));
}

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
    const due = getDueMinutes({ date: context.days[dayIndex]?.date, lane });
    const budget = Math.max(room * share, due);
    const head = lane.units[0];

    if (head && head.minutes > budget + EPSILON && !isCadencedBehind({ dayIndex, lane })) {
      return;
    }

    lane.quota -= takeBlock({ budget, context, dayEnd, lane, state });
  });
}
