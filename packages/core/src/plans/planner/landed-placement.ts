import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { type BuildPlanInput } from "./build-plan";
import { listBegunSkillIds } from "./carried-bases";
import { type LandedUnits, type Landing, listLandedUnits } from "./landed-lessons";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { isStandIn } from "./plan-item-rules";
import { type ExistingPlanItem, fromUnit, getItemKey } from "./plan-items";
import { PLAN_EPSILON } from "./plan-precision";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledUnit,
  getCumulativeCapacity,
  getLessonCapacity,
  scheduleUnits,
} from "./schedule-units";
import { splitStandIns } from "./stand-in-parts";

type DayMinutes = Map<string, number>;

function sumMinutes(units: readonly Pick<QueueUnit, "minutes">[]): number {
  return units.reduce((total, unit) => total + unit.minutes, 0);
}

/**
 * The lesson time an item's saved days take from today to `end`; a lesson saved without them
 * takes its day.
 */
function listSavedTime({
  end = null,
  item,
  today,
  unit,
}: {
  end?: Date | null;
  item: ExistingPlanItem;
  today: Date;
  unit?: QueueUnit;
}): [string, number][] {
  const days = readSelectedItemFacts(item.facts)?.days;
  const first = toIsoDate(today);
  const last = end && toIsoDate(end);
  const isKept = (date: string) => date >= first && (!last || date <= last);

  if (days) {
    return days.flatMap(([date, , minutes]) => (isKept(date) ? [[date, minutes]] : []));
  }

  if (!unit || !item.scheduledFor || isStandIn(item)) {
    return [];
  }

  const date = toIsoDate(item.scheduledFor < today ? today : item.scheduledFor);
  return isKept(date) ? [[date, unit.minutes]] : [];
}

function addTime(total: DayMinutes, time: readonly [string, number][], sign = 1) {
  for (const [date, minutes] of time) {
    total.set(date, (total.get(date) ?? 0) + sign * minutes);
  }
}

function listPlacedTime(
  placed: readonly Pick<ScheduledUnit, "studyPortions">[],
): [string, number][] {
  return placed.flatMap(({ studyPortions }) =>
    (studyPortions ?? []).map(({ date, drillMinutes = 0, lessonMinutes }): [string, number] => [
      date,
      lessonMinutes + drillMinutes,
    ]),
  );
}

function fitsHeldTime({ input, landed }: { input: BuildPlanInput; landed: LandedUnits }): boolean {
  return [...landed].every(([skillId, units]) => {
    const standIns = input.items.filter(
      (item) => item.status === "todo" && isStandIn(item) && item.skillId === skillId,
    );

    const saved = standIns.some((item) => readSelectedItemFacts(item.facts)?.days);
    const lessons = units.reduce((total, unit) => total + (unit.lessons ?? 1), 0);

    const held = saved
      ? standIns
          .flatMap((item) => listSavedTime({ item, today: input.today }))
          .reduce((total, [, minutes]) => total + minutes, 0)
      : lessons * DEFAULT_LESSON_MINUTES * input.paceFactor;

    return sumMinutes(units) <= held + PLAN_EPSILON;
  });
}

/**
 * The topics whose lessons landed. A run whose only news is the landing keeps every other item's
 * saved days while the landed lessons need no more time than their stand-ins still hold; longer
 * lessons make the plan longer, which the days after this week have to show.
 */
export function findLandedUnits({
  input,
  landing,
  queue,
}: {
  input: BuildPlanInput;
  landing: Landing | null;
  queue: readonly QueueUnit[];
}): { keepsRest: boolean; landedUnits: LandedUnits | null } {
  const landedUnits = landing && listLandedUnits({ input, landing, queue });

  return {
    keepsRest:
      landedUnits !== null &&
      input.landedOnly === true &&
      fitsHeldTime({ input, landed: landedUnits }),
    landedUnits,
  };
}

/**
 * A topic's lessons start where its stand-in's time did, after the lessons of it the run keeps
 * and the first lesson of a base the learner hasn't begun.
 */
function getFirstDay({
  frozen,
  input,
  landed,
  own,
  skillId,
}: {
  frozen: readonly ExistingPlanItem[];
  input: BuildPlanInput;
  landed: Pick<ReadonlySet<string>, "has">;
  own: readonly [string, number][];
  skillId: string;
}): Date {
  const begun = listBegunSkillIds({ carried: [], items: input.items });

  const firstOf = (base: string) =>
    input.items.flatMap((entry) =>
      entry.status === "todo" &&
      entry.kind === "lesson" &&
      entry.skillId === base &&
      entry.scheduledFor
        ? [entry.scheduledFor.getTime()]
        : [],
    );

  const bases = (input.prerequisites.get(skillId) ?? []).flatMap((base) => {
    const days = landed.has(base) || begun.has(base) ? [] : firstOf(base);
    return days.length > 0 ? [Math.min(...days)] : [];
  });

  const kept = frozen.flatMap((entry) =>
    entry.lessonId && entry.skillId === skillId && entry.scheduledFor
      ? [entry.scheduledFor.getTime()]
      : [],
  );

  const first = own.map(([date]) => date).toSorted()[0];

  return new Date(
    Math.max(input.today.getTime(), first ? fromIsoDate(first).getTime() : 0, ...bases, ...kept),
  );
}

function withRoom({ day, room }: { day: PlanDay; room: number }): PlanDay {
  const open = getLessonCapacity({ ...day, shape: { ...day.shape, reserved: 0 } });
  return { ...day, shape: { ...day.shape, reserved: open - room } };
}

/** The units that begin by `end` fill the room in order, as the schedule lays any units out. */
function fillRoom({
  days,
  end,
  units,
}: {
  days: readonly PlanDay[];
  end: Date | null;
  units: readonly QueueUnit[];
}) {
  if (!end) {
    return scheduleUnits({ days, units });
  }

  const open = getCumulativeCapacity(days.filter((day) => day.date <= end)).at(-1) ?? 0;

  const begun = units.filter((_, index) => sumMinutes(units.slice(0, index)) < open - PLAN_EPSILON);

  return { ...scheduleUnits({ days, units: begun }), dropped: [] };
}

/**
 * Newly written lessons take the place of their stand-in: the topic's lessons, then the lessons
 * it still has to write, fill the room every item the run keeps leaves free, from the day the
 * stand-in started. Each kept item holds the time of its saved days, and the stand-in's own
 * saved time stays the topic's, so no day gets more than it had or than the learner's time. With
 * `end`, only the lessons that begin by it are placed and the rest are laid out after it.
 */
export function placeLandedLessons({
  days,
  end,
  frozen,
  input,
  landed,
  units,
  unitsByKey,
}: {
  days: readonly PlanDay[];
  end: Date | null;
  frozen: readonly ExistingPlanItem[];
  input: BuildPlanInput;
  landed: LandedUnits | null;
  units: readonly QueueUnit[];
  unitsByKey: ReadonlyMap<string, QueueUnit>;
}): {
  dropped: DroppedUnit[];
  kept: ExistingPlanItem[];
  lessons: Map<string, ScheduledUnit[]>;
  placed: ScheduledUnit[];
} {
  const savedTime = (item: ExistingPlanItem) =>
    listSavedTime({ end, item, today: input.today, unit: unitsByKey.get(getItemKey(item)) });

  // A stand-in saved without its days holds whatever its day and the ones before it have free.
  const isHeld = (item: ExistingPlanItem) =>
    readSelectedItemFacts(item.facts)?.days
      ? savedTime(item).length > 0
      : !end || (item.scheduledFor !== null && item.scheduledFor <= end);

  const items = input.items.filter(
    (item) =>
      item.status === "todo" &&
      isStandIn(item) &&
      landed?.has(item.skillId ?? "") === true &&
      isHeld(item),
  );

  if (!landed || items.length === 0) {
    return { dropped: [], kept: [], lessons: new Map(), placed: [] };
  }

  const keptKeys = new Set(frozen.map((item) => getItemKey(item)));
  const held: DayMinutes = new Map();

  for (const item of [...frozen, ...items]) {
    addTime(held, savedTime(item));
  }

  const laidOut = items.reduce<{ dropped: DroppedUnit[]; placed: ScheduledUnit[] }>(
    (state, item) => {
      const saved = savedTime(item);
      const own = new Map(saved);
      const skillId = item.skillId ?? "";
      const from = getFirstDay({ frozen, input, landed, own: saved, skillId });

      addTime(held, saved, -1);

      const roomy = days
        .filter((day) => day.date >= from)
        .map((day) => {
          const date = toIsoDate(day.date);
          const free = getLessonCapacity(day) - (held.get(date) ?? 0);
          return withRoom({ day, room: Math.max(own.get(date) ?? 0, free) });
        });

      const laid = fillRoom({
        days: roomy,
        end,
        units: splitStandIns(
          units.filter(
            (unit) => unit.kind === "lesson" && unit.skillId === skillId && !keptKeys.has(unit.key),
          ),
        ),
      });

      addTime(held, listPlacedTime(laid.units));

      return {
        dropped: [...state.dropped, ...laid.dropped],
        placed: [...state.placed, ...laid.units],
      };
    },
    { dropped: [], placed: [] },
  );

  const lessons = laidOut.placed.filter((unit) => unit.lessonId !== null);

  return {
    ...laidOut,
    // The layout counts a placed lesson as work the run keeps, like the items it keeps this week.
    kept: lessons.map((unit) => ({ ...fromUnit(unit), id: unit.key, position: 0 })),
    lessons: Map.groupBy(lessons, (unit) => unit.skillId ?? ""),
  };
}

/** What the layout still has to place: a stand-in keeps the lessons its placed parts left. */
export function withoutPlaced({
  placed,
  units,
}: {
  placed: readonly Pick<QueueUnit, "key" | "minutes">[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const taken = placed.reduce(
    (total, unit) => total.set(unit.key, (total.get(unit.key) ?? 0) + unit.minutes),
    new Map<string, number>(),
  );

  return units.flatMap((unit) => {
    const minutes = unit.minutes - (taken.get(unit.key) ?? 0);

    if (minutes === unit.minutes) {
      return [unit];
    }

    if (unit.lessonId !== null || minutes <= PLAN_EPSILON) {
      return [];
    }

    return [
      {
        ...unit,
        minutes,
        ...(unit.lessons !== undefined && {
          lessons: Math.max(1, Math.round((unit.lessons * minutes) / unit.minutes)),
        }),
      },
    ];
  });
}

/** The layout plans around the time the placed lessons take. */
export function reservePlaced({
  days,
  placed,
}: {
  days: readonly PlanDay[];
  placed: Parameters<typeof listPlacedTime>[0];
}): readonly PlanDay[] {
  if (placed.length === 0) {
    return days;
  }

  const taken: DayMinutes = new Map();
  addTime(taken, listPlacedTime(placed));

  return days.map((day) => {
    const minutes = taken.get(toIsoDate(day.date)) ?? 0;

    return minutes > 0
      ? { ...day, shape: { ...day.shape, reserved: (day.shape.reserved ?? 0) + minutes } }
      : day;
  });
}
