import { keepCarriedAfterBases, listBegunSkillIds } from "./carried-bases";
import { markAfterCarried, scheduleCarriedWork, shiftReserved } from "./carried-schedule";
import { findChapterInProgress } from "./chapter-in-progress";
import { takeFocusedToday } from "./focused-today";
import { getSkillArea } from "./graph-areas";
import { LEARN_KINDS, PHASE_WORK_KINDS } from "./plan-item-rules";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type PlanGraph } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, getLessonCapacity } from "./schedule-units";

export type CarryOver = {
  itemIds?: readonly string[];
  lessonIds: readonly string[];
  todayExceptAreas?: readonly string[] | null;
};

function isTeachable(item: ExistingPlanItem): boolean {
  return LEARN_KINDS.has(item.kind) && (item.lessonId !== null || item.chapterId !== null);
}

function isKeptToday({
  carryOver,
  graph,
  inProgress,
  item,
  today,
}: {
  carryOver: CarryOver;
  graph: PlanGraph;
  inProgress: string | null;
  item: ExistingPlanItem;
  today: Date;
}): boolean {
  const except = carryOver.todayExceptAreas;

  if (!except || item.scheduledFor?.getTime() !== today.getTime()) {
    return false;
  }

  if (inProgress !== null && item.chapterId === inProgress) {
    return true;
  }

  const skill = graph.skills.find((entry) => entry.skillId === item.skillId);
  return !skill || !except.includes(getSkillArea({ graph, skill }));
}

function findCurrentPhase(items: readonly Pick<ExistingPlanItem, "kind" | "phase" | "status">[]) {
  return Math.min(
    ...items.flatMap((item) =>
      item.status === "todo" && PHASE_WORK_KINDS.has(item.kind) ? [item.phase] : [],
    ),
  );
}

export function carriesGiven(
  items: readonly Pick<ExistingPlanItem, "kind" | "phase" | "status">[],
): (item: Pick<ExistingPlanItem, "phase">) => boolean {
  const current = findCurrentPhase(items);
  return (item) => item.phase <= current + 1;
}

function listCarriedKeys({
  carryOver,
  graph,
  items,
  today,
}: {
  carryOver?: CarryOver | null;
  graph: PlanGraph;
  items: readonly ExistingPlanItem[];
  today: Date;
}): string[] {
  if (!carryOver) {
    return [];
  }

  const given = new Set(carryOver.lessonIds);
  const settled = new Set(carryOver.itemIds);
  const carries = carriesGiven(items);
  const inProgress = findChapterInProgress(items);

  const isGiven = (item: ExistingPlanItem) =>
    item.lessonId !== null && given.has(item.lessonId) && carries(item);

  return items
    .filter(
      (item) =>
        item.status === "todo" &&
        LEARN_KINDS.has(item.kind) &&
        ((isTeachable(item) &&
          ((item.scheduledFor !== null && item.scheduledFor < today) ||
            isGiven(item) ||
            settled.has(item.id))) ||
          isKeptToday({ carryOver, graph, inProgress, item, today })),
    )
    .toSorted((a, b) => a.position - b.position)
    .map((item) => getItemKey(item));
}

function listKeptTodayKeys({
  carryOver,
  graph,
  items,
  today,
}: {
  carryOver?: CarryOver | null;
  graph: PlanGraph;
  items: readonly ExistingPlanItem[];
  today: Date;
}): Set<string> {
  if (!carryOver) {
    return new Set();
  }

  const inProgress = findChapterInProgress(items);

  return new Set(
    items
      .filter(
        (item) =>
          item.status === "todo" &&
          LEARN_KINDS.has(item.kind) &&
          isKeptToday({ carryOver, graph, inProgress, item, today }),
      )
      .map((item) => getItemKey(item)),
  );
}

function splitFirstLesson(unit: QueueUnit): { first: QueueUnit; rest: QueueUnit | null } {
  const lessons = unit.lessons ?? 1;

  if (unit.lessonId !== null || lessons <= 1) {
    return { first: unit, rest: null };
  }

  const perLesson = unit.minutes / lessons;

  return {
    first: { ...unit, lessons: 1, minutes: perLesson },
    rest: { ...unit, lessons: lessons - 1, minutes: unit.minutes - perLesson },
  };
}

function splitCarriedUnits({
  keys,
  units,
}: {
  keys: readonly string[];
  units: readonly QueueUnit[];
}): { carried: QueueUnit[]; rest: QueueUnit[] } {
  const order = new Map(keys.map((key, index) => [key, index]));

  const split = units.map((unit) =>
    order.has(unit.key) ? splitFirstLesson(unit) : { first: null, rest: unit },
  );

  return {
    carried: split
      .flatMap(({ first }) => (first ? [first] : []))
      .toSorted((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)),
    rest: split.flatMap(({ rest }) => (rest ? [rest] : [])),
  };
}

export function reserveCarriedTime({
  days,
  minutes,
}: {
  days: readonly PlanDay[];
  minutes: number;
}): PlanDay[] {
  return days.reduce<{ days: PlanDay[]; left: number }>(
    (state, day) => {
      const taken = Math.min(state.left, getLessonCapacity(day));
      const reserved = (day.shape.reserved ?? 0) + taken;

      state.days.push(taken > 0 ? { ...day, shape: { ...day.shape, reserved } } : day);
      return { days: state.days, left: state.left - taken };
    },
    { days: [], left: minutes },
  ).days;
}

export function placeCarriedWork({
  days,
  input,
  phaseEnds,
  units,
  yielded = new Set(),
}: {
  days: readonly PlanDay[];
  input: {
    carryOver?: CarryOver | null;
    graph: PlanGraph;
    items: readonly ExistingPlanItem[];
    prerequisites: ReadonlyMap<string, readonly string[]>;
    today: Date;
  };
  phaseEnds: ReadonlyMap<number, Date>;
  units: readonly QueueUnit[];
  yielded?: ReadonlySet<string>;
}) {
  const today = listKeptTodayKeys(input);

  const left = listCarriedKeys(input).filter((key) => today.has(key) || !yielded.has(key));

  const keys = keepCarriedAfterBases({
    begun: listBegunSkillIds({ carried: [], items: input.items }),
    keys: left,
    prerequisites: input.prerequisites,
    today,
    units,
  });

  const { carried, rest } = splitCarriedUnits({ keys, units });

  const { room, roomed, schedule } = scheduleCarriedWork({ carried, days, phaseEnds, rest, today });

  const reserved = shiftReserved({
    days: reserveCarriedTime({
      days: roomed,
      minutes: carried.reduce((total, unit) => total + unit.minutes, 0),
    }),
    minutes: new Map([...room].map(([time, minutes]) => [time, -minutes])),
  });

  const steered = input.carryOver?.todayExceptAreas
    ? takeFocusedToday({
        begun: listBegunSkillIds({ carried, items: input.items }),
        days: reserved,
        prerequisites: input.prerequisites,
        units: rest,
      })
    : { days: reserved, rest, today: [] };

  const placed = { ...schedule, units: [...schedule.units, ...steered.today] };

  return {
    carried: [...carried, ...steered.today],
    days: steered.days,
    released: left.filter((key) => !keys.includes(key)),
    rest: markAfterCarried({ schedule: placed, units: steered.rest }),
    schedule: placed,
  };
}
