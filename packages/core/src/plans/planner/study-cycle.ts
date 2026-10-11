import { type QueueUnit } from "./plan-units";
import { type PlanDay, findDayIndex, getLessonCapacity } from "./schedule-units";
import { splitStandIns } from "./stand-in-parts";
import {
  EPSILON,
  appendRest,
  fillRest,
  forceStuckLessons,
  placeUnit,
  takeBlock,
} from "./study-cycle-blocks";
import { getBudgets, getReserves, isDue } from "./study-cycle-budgets";
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

function prefixSums(values: readonly number[]): number[] {
  return values.reduce<number[]>((sums, value) => {
    sums.push((sums.at(-1) ?? 0) + value);
    return sums;
  }, []);
}

/**
 * The subjects of one day: among the ready ones that have joined, those that have had the least
 * time for what they're worth, the cycle's order breaking ties; a subject joins early only when
 * too few have. The skills of other subjects that a joined subject builds on are brought forward
 * in theirs (`pullPrerequisites`). A subject that waited (for a prerequisite or to join)
 * starts at the pass of the first subject chosen, so it doesn't save up time while it waits. The
 * subject of the chapter in progress takes the last place by the day the learner saw its next
 * lesson on, so a change never pushes that chapter back (R10).
 */
function chooseLanes({
  context,
  count,
  date,
  state,
}: {
  context: CycleContext;
  count: number;
  date: Date | undefined;
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

  const due = ranked.slice(count).filter((lane) => isDue({ date, lane }));
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

/** A unit's place in the day, by its subject's place among the day's subjects. */
function toLaneRank({ lanes, unit }: { lanes: readonly Lane[]; unit: QueueUnit }): number {
  const rank = lanes.findIndex((lane) => lane.area === unit.area);
  return rank === -1 ? lanes.length : rank;
}

/** Whether every unit comes after the units of the same day that teach its prerequisites. */
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

/**
 * The day's lessons as blocks, one subject after another: what a subject got after the others'
 * blocks (lessons don't split, so a day's last minutes go back to its subjects) joins its block,
 * unless a lesson would come before one it builds on.
 */
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

/**
 * Fills one day: an area practiced on days of its own takes its part first (see
 * `takeCadencedBlocks`), then each chosen subject gets a share of the day's lesson time in
 * proportion to what it's worth, in one block each, in the order they were chosen; what the blocks
 * leave (lessons don't split) goes to the same subjects again, then to the next ones due. A first
 * lesson longer than what's left of the day still goes, and runs into the days after.
 */
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
  const chosen = chooseLanes({ context, count, date: day?.date, state });
  const room = dayEnd - state.used;
  const start = state.used;
  const from = state.placed.length;
  const [first] = chosen;

  const behind = cadenced.find(
    (lane) =>
      isCadencedBehind({ dayIndex, lane }) &&
      isUnitReady({ context, left: state.left, unit: lane.units[0] }),
  );

  const lead = behind ?? first;
  const head = lead?.units[0];

  // A lesson longer than the day goes when its subject is the most due, and takes the days it
  // spans; waiting for a day it fits would keep it out of the plan for good. An area practiced on
  // days of its own is the most due once it's behind: at 5 minutes a day, every lesson is longer
  // than the day, and ENEM's essay never had a turn. Only once what its next lesson builds on has
  // started, as in the rotation: Câmara's essays went before the political science they build on.
  if (lead && head && head.minutes > room + EPSILON) {
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

  const budgets = getBudgets({ chosen, date: day?.date, left: dayEnd - state.used });
  const reserves = getReserves({ chosen, date: day?.date });

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

/**
 * Ends a filled day: minutes no lesson fitted in stay unused, so the next day's first subject
 * starts on that day instead of slipping a lesson into this one. A day with no lessons at all (one
 * an area practiced on days of its own waits through) is skipped whole.
 */
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

  if (state.used + EPSILON < dayEnd) {
    state.used = dayEnd;
    state.closedDay = true;
    state.skippedDay ||= empty;
  }
}

/**
 * Fills the days in order, each one that still has lesson time while there are lessons to place.
 * A lesson that runs past its day uses up the days it spans. The areas practiced on days of their
 * own (`cadenced`) keep the days going after the others' lessons only in the last part.
 */
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

    if (hasUnits && dayEnd > state.used + EPSILON) {
      fillDay({ context, dayIndex, state });
    }
  });
}

/**
 * Arranges an exam's lessons as a study cycle a teacher would write: each day covers a few
 * subjects (one to four, by the day's minutes; see `getSubjectsPerDay`) in a block each, and the
 * subjects rotate so every one comes back within days, the ones worth more (`rates`: the exam's
 * weight and the learner's gaps) in longer blocks. Each subject keeps its teaching order, a skill
 * starts only once its prerequisites are placed, the first days open with the subjects placement
 * found gaps in and the ones worth most, and subjects that start in later phases join over the
 * first two weeks (`MAX_JOIN_DAYS`). A skill not outlined yet takes its turns like the others, in
 * parts about a lesson long (`splitStandIns`; `joinStandIns` makes them one item again once
 * they're scheduled). Days come from the same capacities `scheduleUnits` lays units on, so each
 * day's lessons land on it.
 */
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
  /** The phase each area starts in the skill graph (`toLanes`). */
  areaPhases?: ReadonlyMap<string, number>;
  /** Areas practiced on days of their own instead of in the rotation (see `CadencedArea`). */
  cadenced?: ReadonlyMap<string, CadencedArea>;
  days: readonly PlanDay[];
  /** The subjects placement found gaps in, which open the cycle (`toLanes`). */
  firstAreas?: ReadonlySet<string>;
  /** The notice's parts the learner said they know, which open it after the others (`toLanes`). */
  knownAreas?: ReadonlySet<string>;
  /** The notice's parts, which open it before areas beyond it; null without a notice. */
  noticeAreas?: ReadonlySet<string> | null;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  /** What each area is worth per minute of study, relative to the others. */
  rates: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const parts = splitStandIns(units);

  const counts = countBySkill(parts);

  const context: CycleContext = {
    areas: new Map(units.flatMap((unit) => (unit.skillId ? [[unit.skillId, unit.area]] : []))),
    counts,
    cumulative: prefixSums(days.map((day) => getLessonCapacity(day))),
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

    // A checkpoint closes its day, as `scheduleUnits` lays it: the next phase starts the day after.
    if (checkpoint) {
      const needed = state.used + checkpoint.minutes;
      const dayIndex = findDayIndex({ cumulative: context.cumulative, needed });

      state.placed.push(checkpoint);
      state.used = Math.max(needed, context.cumulative[dayIndex] ?? needed);
    }
  });

  return state.placed;
}
