import { findDayIndex } from "./day-index";
import { PLAN_EPSILON } from "./plan-precision";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, getCumulativeCapacity } from "./schedule-units";
import { splitStandIns } from "./stand-in-parts";
import {
  appendRest,
  fillRest,
  forceStuckLessons,
  placeUnit,
  takeBlock,
} from "./study-cycle-blocks";
import { getBudgets, getReserves, isDue, toDueDates } from "./study-cycle-budgets";
import {
  hasCadencedLeft,
  isCadencedBehind,
  listOpenCadenced,
  takeCadencedBlocks,
  toCadencedLanes,
} from "./study-cycle-cadence";
import {
  type CadencedArea,
  type CycleContext,
  type CycleState,
  type Lane,
  countBySkill,
  getJoinWindow,
  getSubjectsPerDay,
  isUnitReady,
  pullPrerequisites,
  toLanes,
} from "./study-cycle-lanes";
import { listStartingParts, splitIntoParts, splitWaiting } from "./study-cycle-parts";

function chooseLanes({
  context,
  count,
  dateOf,
  state,
}: {
  context: CycleContext;
  count: number;
  dateOf: (lane: Lane) => Date | undefined;
  state: CycleState;
}): Lane[] {
  const open = state.lanes.filter((lane) => lane.units.length > 0);
  const isWaiting = (lane: Lane) => lane.joinDay > state.studyDay;

  open
    .filter((lane) => !isWaiting(lane))
    .forEach((lane) => pullPrerequisites({ context, lane, lanes: state.lanes, left: state.left }));

  const ready = open.filter((lane) =>
    isUnitReady({ context, left: state.left, unit: lane.units[0] }),
  );

  const ranked = ready.toSorted(
    (a, b) => Number(isWaiting(a)) - Number(isWaiting(b)) || a.pass - b.pass || a.order - b.order,
  );

  const due = ranked.slice(count).filter((lane) => isDue({ date: dateOf(lane), lane }));
  const chosen = [...ranked.slice(0, Math.max(0, count - due.length)), ...due];
  const floor = chosen[0]?.pass ?? 0;

  open
    .filter((lane) => !chosen.includes(lane) && (!ready.includes(lane) || isWaiting(lane)))
    .forEach((lane) => {
      lane.pass = Math.max(lane.pass, floor);
    });

  // A prerequisite cycle the graph normalizer missed must not stall the plan.
  return chosen.length > 0 ? chosen : open.slice(0, 1);
}

function toLaneRank({ lanes, unit }: { lanes: readonly Lane[]; unit: QueueUnit }): number {
  const rank = lanes.findIndex((lane) => lane.area === unit.area);
  return rank === -1 ? lanes.length : rank;
}

function keepsPrerequisites({
  context,
  units,
}: {
  context: CycleContext;
  units: readonly QueueUnit[];
}): boolean {
  return units.every((unit, index) => {
    const required = new Set(unit.skillId ? (context.prerequisites.get(unit.skillId) ?? []) : []);
    return units.slice(index + 1).every((later) => !later.skillId || !required.has(later.skillId));
  });
}

function groupDayBySubject({
  context,
  from,
  lanes,
  state,
}: {
  context: CycleContext;
  from: number;
  lanes: readonly Lane[];
  state: CycleState;
}): void {
  const day = state.placed.slice(from);
  const opening = day.find((unit) => unit.opensDay);

  const grouped = day
    .map(({ opensDay: _opens, startsAt: _starts, ...unit }) => unit)
    .toSorted((a, b) => toLaneRank({ lanes, unit: a }) - toLaneRank({ lanes, unit: b }))
    .map((unit, index) =>
      index === 0 && opening
        ? {
            ...unit,
            opensDay: true,
            ...(opening.startsAt !== undefined && { startsAt: opening.startsAt }),
          }
        : unit,
    );

  if (keepsPrerequisites({ context, units: grouped })) {
    state.placed.splice(from, day.length, ...grouped);
  }
}

function fillDay({
  context,
  dayIndex,
  state,
}: {
  context: CycleContext;
  dayIndex: number;
  state: CycleState;
}): void {
  const day = context.days[dayIndex];
  const dayEnd = context.cumulative[dayIndex] ?? 0;
  const cadenced = listOpenCadenced({ dayIndex, state });
  const count = Math.max(1, getSubjectsPerDay(day?.shape.minutes ?? 0) - cadenced.length);
  const dateOf = toDueDates({ context, dayIndex, state });
  const chosen = chooseLanes({ context, count, dateOf, state });
  const room = dayEnd - state.used;
  const start = state.used;
  const from = state.placed.length;
  const [first] = chosen;

  const behind = cadenced.find(
    (lane) =>
      isCadencedBehind({ dayIndex, lane }) &&
      isUnitReady({ context, left: state.left, unit: lane.units[0] }),
  );

  const lead = behind ?? chosen.find((lane) => isDue({ date: dateOf(lane), lane })) ?? first;
  const head = lead?.units[0];

  if (lead && head && head.minutes > room + PLAN_EPSILON) {
    placeUnit({ lane: lead, state });

    if (behind) {
      behind.quota -= head.minutes;
    } else {
      lead.pass += head.minutes / lead.rate;
    }

    state.studyDay += 1;
    return;
  }

  takeCadencedBlocks({ context, dayEnd, dayIndex, lanes: cadenced, state });

  const budgets = getBudgets({ chosen, date: day?.date, dateOf, left: dayEnd - state.used });
  const reserves = getReserves({ chosen, date: day?.date, dateOf });

  const taken = new Map(
    chosen.map((lane) => [
      lane,
      takeBlock({
        budget: budgets.get(lane) ?? 0,
        context,
        dayEnd: dayEnd - (reserves.get(lane) ?? 0),
        lane,
        state,
      }),
    ]),
  );

  const others = fillRest({ chosen, context, dayEnd, state, taken });

  forceStuckLessons({ chosen, context, dayEnd, others, start, state, taken });

  taken.forEach((minutes, lane) => {
    lane.pass += minutes / lane.rate;
  });

  groupDayBySubject({ context, from, lanes: [...chosen, ...others], state });
  closeDay({ dayEnd, empty: state.placed.length === from, state });
}

function closeDay({
  dayEnd,
  empty,
  state,
}: {
  dayEnd: number;
  empty: boolean;
  state: CycleState;
}): void {
  state.studyDay += 1;

  if (state.used + PLAN_EPSILON < dayEnd) {
    state.used = dayEnd;
    state.closedDay = true;
    state.skippedDay ||= empty;
  }
}

function arrangeDays({
  cadenced,
  context,
  state,
}: {
  cadenced: boolean;
  context: CycleContext;
  state: CycleState;
}): void {
  context.cumulative.forEach((dayEnd, dayIndex) => {
    const hasUnits =
      state.lanes.some((lane) => lane.units.length > 0) ||
      (cadenced && state.cadenced.some((lane) => hasCadencedLeft(lane)));

    if (hasUnits && dayEnd > state.used + PLAN_EPSILON) {
      fillDay({ context, dayIndex, state });
    }
  });
}

export function arrangeStudyCycle({
  areaPhases,
  cadenced = new Map(),
  days,
  firstAreas,
  knownAreas,
  noticeAreas,
  prerequisites,
  rates,
  units,
}: {
  areaPhases?: ReadonlyMap<string, number>;
  cadenced?: ReadonlyMap<string, CadencedArea>;
  days: readonly PlanDay[];
  firstAreas?: ReadonlySet<string>;
  knownAreas?: ReadonlySet<string>;
  noticeAreas?: ReadonlySet<string> | null;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  rates: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const parts = splitStandIns(units);

  const counts = countBySkill(parts);

  const context: CycleContext = {
    areas: new Map(units.flatMap((unit) => (unit.skillId ? [[unit.skillId, unit.area]] : []))),
    counts,
    cumulative: getCumulativeCapacity(days),
    days,
    prerequisites,
  };

  const isCadenced = (unit: QueueUnit) => unit.kind !== "boss" && cadenced.has(unit.area);

  const state: CycleState = {
    cadenced: toCadencedLanes({
      cadenced,
      context,
      units: parts.filter((unit) => isCadenced(unit)),
    }),
    closedDay: false,
    lanes: [],
    left: new Map(counts),
    placed: [],
    skippedDay: false,
    studyDay: 0,
    used: 0,
  };

  const joinWindow = getJoinWindow(days);
  const groups = splitIntoParts(parts.filter((unit) => !isCadenced(unit)));
  const startsIn = listStartingParts(groups);
  let waiting: QueueUnit[] = [];

  groups.forEach((group, index) => {
    const checkpoint = group.find((unit) => unit.kind === "boss");
    const isLast = index === groups.length - 1;

    const split = splitWaiting({
      context,
      index,
      left: state.left,
      lessons: [...waiting, ...group.filter((unit) => unit.kind !== "boss")],
      startsIn,
    });

    const lessons = split.now;
    waiting = split.waiting;

    state.lanes = toLanes({
      areaPhases,
      firstAreas,
      joinWindow,
      knownAreas,
      noticeAreas,
      prerequisites,
      rates,
      units: lessons,
    });

    arrangeDays({ cadenced: isLast, context, state });

    appendRest({
      context,
      lanes: isLast ? [...state.lanes, ...state.cadenced] : state.lanes,
      state,
    });

    if (checkpoint) {
      const needed = state.used + checkpoint.minutes;
      const dayIndex = findDayIndex({ cumulative: context.cumulative, needed });

      state.placed.push(checkpoint);
      state.used = Math.max(needed, context.cumulative[dayIndex] ?? needed);
    }
  });

  return state.placed;
}
