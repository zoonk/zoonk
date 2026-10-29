import { type BuildPlanInput } from "./build-plan";
import { type Held, findHeld, listHeldFrom, listHeldTime, sumByDay, sumMinutes } from "./held-time";
import { getOneDayStudy } from "./interval-study-minutes";
import { getBaseDays, getStandInDays } from "./landed-days";
import { type LandedUnits, withoutWrittenStandIns } from "./landed-lessons";
import { isStandIn, isUnwrittenLesson } from "./plan-item-rules";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { PLAN_EPSILON } from "./plan-precision";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledUnit,
  getLessonCapacity,
} from "./schedule-units";

const BETWEEN = 0.5;

type KeptTime = { date: Date; minutes: number };

export function listKeptTime({
  frozen,
  units,
}: {
  frozen: readonly ExistingPlanItem[];
  units: ReadonlyMap<string, QueueUnit>;
}): KeptTime[] {
  return frozen.flatMap((item) => {
    const unit = units.get(getItemKey(item));

    return unit && item.scheduledFor && !isStandIn(item)
      ? [{ date: item.scheduledFor, minutes: unit.minutes }]
      : [];
  });
}

type Placed = { anchor: number; unit: ScheduledUnit };

type Layout = {
  dayOn: (date: Date) => PlanDay | undefined;
  days: readonly PlanDay[];
  laid: readonly ScheduledUnit[];
  limitOn: (date: Date) => number;
  taken: Map<number, number>;
  usedOn: (date: Date) => number;
};

function toPlaced({
  anchor,
  date,
  layout,
  part,
  unit,
}: {
  anchor: number;
  date: Date;
  layout: Layout;
  part: ScheduledUnit | undefined;
  unit: QueueUnit;
}): Placed {
  const shape = layout.dayOn(date)?.shape;

  layout.taken.set(date.getTime(), (layout.taken.get(date.getTime()) ?? 0) + unit.minutes);

  return {
    anchor,
    unit: {
      ...unit,
      date,
      phase: shape?.phase ?? part?.phase ?? unit.phase,
      ...getOneDayStudy({ date, lessonMinutes: unit.minutes, share: shape?.share ?? 1 }),
    },
  };
}

function findRoom({
  after,
  layout,
  slot,
  unit,
}: {
  after: Date | null;
  layout: Layout;
  slot: Held;
  unit: QueueUnit;
}): Date | undefined {
  const from = after && after > slot.date ? after : slot.date;

  const hasRoom = (date: Date) => {
    const limit = layout.limitOn(date);
    const used = layout.usedOn(date);

    return (
      used + unit.minutes <= limit + PLAN_EPSILON ||
      (used <= PLAN_EPSILON && limit > PLAN_EPSILON && unit.minutes > limit)
    );
  };

  return layout.days.find(({ date }) => date >= from && hasRoom(date))?.date;
}

function findDay({
  after,
  first,
  floor,
  index,
  layout,
  slot,
  unit,
}: {
  after: Date | null;
  first: Date | undefined;
  floor: Date | undefined;
  index: number;
  layout: Layout;
  slot: Held;
  unit: QueueUnit;
}): Date | undefined {
  if (index === 0) {
    const day = first && first < slot.date ? first : slot.date;
    return floor && floor > day ? floor : day;
  }

  return findRoom({ after, layout, slot, unit });
}

function placeSkill({
  cut,
  first,
  floor,
  held,
  layout,
  perLesson,
  units,
}: {
  cut: boolean;
  first: Date | undefined;
  floor: Date | undefined;
  held: readonly Held[];
  layout: Layout;
  perLesson: number;
  units: readonly QueueUnit[];
}): { leftOut: QueueUnit[]; placed: Placed[] } {
  const total = sumMinutes(held);
  const written = units.filter((unit) => unit.lessonId !== null);

  const lessons = cut
    ? written.filter((_, index) => index * perLesson < total - PLAN_EPSILON)
    : written;

  const { leftOut, placed } = lessons.reduce<{
    after: Date | null;
    leftOut: QueueUnit[];
    placed: Placed[];
  }>(
    (state, unit, index) => {
      const slot = findHeld(held, index * perLesson) ?? held.at(-1);

      const date = slot && findDay({ after: state.after, first, floor, index, layout, slot, unit });

      if (!slot || !date) {
        return { ...state, leftOut: [...state.leftOut, unit] };
      }

      const part = layout.laid[slot.index];
      const anchor = date > slot.date ? findAnchor({ date, laid: layout.laid }) : slot.index;

      return {
        ...state,
        after: date,
        placed: [...state.placed, toPlaced({ anchor, date, layout, part, unit })],
      };
    },
    { after: null, leftOut: [], placed: [] },
  );

  const rest = units.find((unit) => unit.lessonId === null);
  const from = lessons.length * perLesson;
  const minutes = Math.min(rest?.minutes ?? 0, total - from);

  const pieces = rest
    ? listHeldFrom({ from, held, minutes }).map((piece) =>
        toPlaced({
          anchor: piece.index,
          date: piece.date,
          layout,
          part: layout.laid[piece.index],
          unit: { ...rest, minutes: piece.minutes },
        }),
      )
    : [];

  return {
    leftOut: [...leftOut, ...written.slice(lessons.length)],
    placed: [...placed, ...pieces],
  };
}

function findAnchor({ date, laid }: { date: Date; laid: readonly ScheduledUnit[] }): number {
  const index = laid.findIndex((unit) => unit.date >= date);
  return (index === -1 ? laid.length : index) - BETWEEN;
}

export function putLandedLessons({
  days,
  dropped = [],
  input,
  kept = null,
  keptParts,
  landed,
  start,
  units,
}: {
  days: readonly PlanDay[];
  dropped?: readonly DroppedUnit[];
  input: BuildPlanInput;
  kept?: readonly KeptTime[] | null;
  keptParts: readonly ScheduledUnit[];
  landed: LandedUnits | null;
  start: Date;
  units: readonly ScheduledUnit[];
}): { dropped: DroppedUnit[]; laidOut: ScheduledUnit[]; landed: ScheduledUnit[] } {
  if (!landed || landed.size === 0) {
    return { dropped: [...dropped], laidOut: kept ? [] : [...units], landed: [] };
  }

  const isPart = (unit: ScheduledUnit) => isUnwrittenLesson(unit) && landed.has(unit.skillId ?? "");

  const laid = [...units, ...keptParts.filter((unit) => isPart(unit))].toSorted(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const byDate = new Map(days.map((day) => [day.date.getTime(), day]));
  const dayOn = (date: Date) => byDate.get(date.getTime());

  const capacityOn = (date: Date) => {
    const day = dayOn(date);
    return day ? getLessonCapacity(day) : 0;
  };

  const others = kept
    ? [...kept, ...laid.filter((unit) => isUnwrittenLesson(unit) && !isPart(unit))]
    : laid.filter((unit) => !isPart(unit));

  const other = sumByDay(others);
  const otherOn = (date: Date) => other.get(date.getTime()) ?? 0;
  const claimed = new Map<number, number>();

  const heldBySkill = new Map(
    [...landed.keys()].map((skillId) => [
      skillId,
      listHeldTime({
        claimed,
        days,
        free: (date) => capacityOn(date) - otherOn(date),
        laid,
        parts: laid.flatMap((unit, index) =>
          isPart(unit) && unit.skillId === skillId ? [index] : [],
        ),
      }),
    ]),
  );

  const heldByDay = sumByDay([...heldBySkill.values()].flat());
  const shownUntil = input.todayShown ? input.today : null;
  const taken = new Map<number, number>();

  const layout: Layout = {
    dayOn,
    days,
    laid,
    limitOn: (date) => {
      const before = otherOn(date) + (heldByDay.get(date.getTime()) ?? 0);
      const most = Math.max(capacityOn(date), kept ? otherOn(date) : before);
      return shownUntil && date <= shownUntil ? Math.min(before, most) : most;
    },
    taken,
    usedOn: (date) => otherOn(date) + (taken.get(date.getTime()) ?? 0),
  };

  const firstDays = getStandInDays(input);
  const baseDays = getBaseDays({ input, keeps: kept !== null, laid, landed });
  const perLesson = DEFAULT_LESSON_MINUTES * input.paceFactor;

  const cut = new Set(dropped.flatMap((unit) => unit.skillId ?? []));

  const skills = [...landed].map(([skillId, skillUnits]) =>
    placeSkill({
      cut: cut.has(skillId),
      first: firstDays.get(skillId),
      floor: baseDays.get(skillId),
      held: heldBySkill.get(skillId) ?? [],
      layout,
      perLesson,
      units: skillUnits,
    }),
  );

  const placed = skills.flatMap((skill) => skill.placed);

  const all = [
    ...laid.flatMap((unit, index) => (isPart(unit) ? [] : [{ anchor: index, unit }])),
    ...placed,
  ]
    .toSorted((a, b) => a.anchor - b.anchor)
    .map((entry) => entry.unit);

  const ours = new Set(placed.map((entry) => entry.unit));

  const restStart = new Map(
    placed
      .toReversed()
      .flatMap(({ unit }) => (unit.lessonId ? [] : [[unit.skillId ?? "", unit.date] as const])),
  );

  const isThisWeek = (unit: ScheduledUnit) =>
    ours.has(unit) &&
    (unit.lessonId ? unit.date : (restStart.get(unit.skillId ?? "") ?? unit.date)) < start;

  return {
    dropped: [
      ...withoutWrittenStandIns({ dropped, landed }),
      ...skills.flatMap((skill) => skill.leftOut.map((unit) => ({ ...unit, fittedMinutes: 0 }))),
    ],
    laidOut: all.filter((unit) => !isThisWeek(unit) && (!kept || ours.has(unit))),
    landed: all.filter((unit) => isThisWeek(unit)),
  };
}
