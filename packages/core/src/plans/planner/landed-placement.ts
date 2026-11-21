import { type BuildPlanInput } from "./build-plan";
import {
  type DayTime,
  type Held,
  type KeptTime,
  findHeld,
  listHeldFrom,
  listHeldTime,
  sumByDay,
  sumByPortionDay,
  sumMinutes,
  takeRoom,
} from "./held-time";
import { getOneDayStudy } from "./interval-study-minutes";
import { getBaseDays, getLastKeptLessonDays, getStandInDays } from "./landed-days";
import { type LandedUnits, withoutWrittenStandIns } from "./landed-lessons";
import { isUnwrittenLesson } from "./plan-item-rules";
import { PLAN_EPSILON } from "./plan-precision";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledUnit,
  getLessonCapacity,
} from "./schedule-units";

const BETWEEN = 0.5;

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
  portions,
  unit,
}: {
  anchor: number;
  date: Date;
  layout: Layout;
  part: ScheduledUnit | undefined;
  portions: readonly DayTime[];
  unit: QueueUnit;
}): Placed {
  const studyPortions = portions.flatMap((portion) => {
    const day = portion.date.getTime();
    const share = layout.dayOn(portion.date)?.shape.share ?? 1;

    layout.taken.set(day, (layout.taken.get(day) ?? 0) + portion.minutes);

    return getOneDayStudy({ date: portion.date, lessonMinutes: portion.minutes, share })
      .studyPortions;
  });

  return {
    anchor,
    unit: {
      ...unit,
      date,
      phase: layout.dayOn(date)?.shape.phase ?? part?.phase ?? unit.phase,
      studyMinutes: studyPortions.reduce((total, portion) => total + portion.minutes, 0),
      studyPortions,
    },
  };
}

function findPortions({
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
}): DayTime[] {
  if (index === 0) {
    const day = first && first < slot.date ? first : slot.date;
    return [{ date: floor && floor > day ? floor : day, minutes: unit.minutes }];
  }

  return takeRoom({
    days: layout.days,
    from: after && after > slot.date ? after : slot.date,
    minutes: unit.minutes,
    room: (date) => layout.limitOn(date) - layout.usedOn(date),
  });
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

      const portions = slot
        ? findPortions({ after: state.after, first, floor, index, layout, slot, unit })
        : [];

      const date = portions.at(-1)?.date;

      if (!slot || !date) {
        return { ...state, leftOut: [...state.leftOut, unit] };
      }

      const part = layout.laid[slot.index];
      const anchor = date > slot.date ? findAnchor({ date, laid: layout.laid }) : slot.index;

      return {
        ...state,
        after: date,
        placed: [...state.placed, toPlaced({ anchor, date, layout, part, portions, unit })],
      };
    },
    { after: null, leftOut: [], placed: [] },
  );

  const rest = units.find((unit) => unit.lessonId === null);
  const from = lessons.length * perLesson;
  const minutes = Math.min(rest?.minutes ?? 0, total - from);

  // Written lessons longer than their estimate take room from the rest, which gives it up.
  const pieces = rest
    ? listHeldFrom({ from, held, minutes }).flatMap((piece) => {
        const room = layout.limitOn(piece.date) - layout.usedOn(piece.date);
        const left = Math.min(piece.minutes, room);
        const portions = [{ date: piece.date, minutes: left }];
        const part = layout.laid[piece.index];
        const unit = { ...rest, minutes: left };

        return left > PLAN_EPSILON
          ? [toPlaced({ anchor: piece.index, date: piece.date, layout, part, portions, unit })]
          : [];
      })
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

  const keptKeys = new Set(kept?.map((time) => time.key));

  const others = kept
    ? [
        ...kept,
        ...laid.filter(
          (unit) => isUnwrittenLesson(unit) && !isPart(unit) && !keptKeys.has(unit.key),
        ),
      ]
    : laid.filter((unit) => !isPart(unit));

  const other = sumByPortionDay(others);
  const otherOn = (date: Date) => other.get(date.getTime()) ?? 0;
  const claimed = new Map<number, number>();
  const lastDays = getLastKeptLessonDays({ input, keeps: kept !== null });

  const heldBySkill = new Map(
    [...landed.keys()].map((skillId) => [
      skillId,
      listHeldTime({
        claimed,
        days,
        floor: lastDays.get(skillId),
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
