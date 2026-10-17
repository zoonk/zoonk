import { type BuildPlanInput } from "./build-plan";
import {
  EPSILON,
  type Held,
  findHeld,
  listHeldFrom,
  listHeldTime,
  sumByDay,
  sumMinutes,
} from "./held-time";
import { isStandInItem } from "./kept-items";
import { getBaseDays, getStandInDays } from "./landed-days";
import { type LandedUnits } from "./landed-lessons";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledUnit,
  getLessonCapacity,
} from "./schedule-units";

/** Half a place: a unit put between two of the run's units. */
const BETWEEN = 0.5;

/** An item a landing-only run keeps, with its time on the day it's saved for (see `listKeptTime`). */
type KeptTime = { date: Date; minutes: number };

/**
 * A landing-only run's kept items but stand-ins, each with its time on the day it's saved for (see
 * `BuildPlanInput.landedOnly`): what each day holds besides the stand-ins' parts, which the plan
 * saves as one item on its first part's day.
 */
export function listKeptTime({
  frozen,
  units,
}: {
  frozen: readonly ExistingPlanItem[];
  units: ReadonlyMap<string, QueueUnit>;
}): KeptTime[] {
  return frozen.flatMap((item) => {
    const unit = units.get(getItemKey(item));

    return unit && item.scheduledFor && !isStandInItem(item)
      ? [{ date: item.scheduledFor, minutes: unit.minutes }]
      : [];
  });
}

/** A landed unit and where it goes among the run's units (a place in them, between two). */
type Placed = { anchor: number; unit: ScheduledUnit };

/** What a run laid out around the landed skills: its days and what each of them holds. */
type Layout = {
  dayOn: (date: Date) => PlanDay | undefined;
  days: readonly PlanDay[];
  laid: readonly ScheduledUnit[];
  /** The most lesson time a day can take (see `putLandedLessons`). */
  limitOn: (date: Date) => number;
  /** Each day's time the landed lessons took so far, shared by the landed skills. */
  taken: Map<number, number>;
  usedOn: (date: Date) => number;
};

/** A landed unit on its day, among the run's units at `anchor`. */
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
  /** The stand-in's part whose time it takes. */
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
      studyMinutes: unit.minutes / (shape?.share || 1),
    },
  };
}

/**
 * The day a landed skill's lesson goes on: the first from the day its estimate starts in its
 * stand-in's time (`slot`), never before the skill's lesson before it (`after`), with room for it
 * by the goal's date (the plan's last day); none when no day has room. A lesson longer than a
 * day's whole time takes a day of its own, never one with no lesson time: a class test's last day,
 * its short mock and review, took a lesson written since. A lesson that goes past its phase's
 * challenge on the end the learner saw stays there: Today offers to move that end past it (see
 * `listEndsBeforeLessons`, N90). Kept before the challenge, a learn plan's longer lessons were
 * left out instead.
 */
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
      used + unit.minutes <= limit + EPSILON ||
      (used <= EPSILON && limit > EPSILON && unit.minutes > limit)
    );
  };

  return layout.days.find(({ date }) => date >= from && hasRoom(date))?.date;
}

/** The day a landed skill's lesson goes on: its first keeps its stand-in's day (see `findRoom`). */
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
  /** The first day its skill's lessons may go on (see `getBaseDays`). */
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

/**
 * One landed skill's lessons in its stand-in's time (see `putLandedLessons`), then what isn't
 * written yet, as a stand-in in the time after them. `leftOut` are the lessons no day by the
 * goal's date has room for, and, when the run's cut left part of the skill out, those past its
 * time, as its cut left them.
 */
function placeSkill({
  cut,
  first,
  floor,
  held,
  layout,
  perLesson,
  units,
}: {
  /** Whether the run's cut left part of the skill out: its stand-in's time is what it kept. */
  cut: boolean;
  /** The day its stand-in is saved for, today at the earliest. */
  first: Date | undefined;
  /** The first day its lessons may go on (see `getBaseDays`). */
  floor: Date | undefined;
  held: readonly Held[];
  layout: Layout;
  perLesson: number;
  units: readonly QueueUnit[];
}): { leftOut: QueueUnit[]; placed: Placed[] } {
  const total = sumMinutes(held);
  const written = units.filter((unit) => unit.lessonId !== null);
  const lessons = cut ? written.filter((_, index) => index * perLesson < total - EPSILON) : written;

  const { leftOut, placed } = lessons.reduce<{
    after: Date | null;
    leftOut: QueueUnit[];
    placed: Placed[];
  }>(
    (state, unit, index) => {
      // Past its time, a lesson goes on the next day with room from the time's last day.
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

/** Where a lesson moved to a later day goes among the run's units: first on that day. */
function findAnchor({ date, laid }: { date: Date; laid: readonly ScheduledUnit[] }): number {
  const index = laid.findIndex((unit) => unit.date >= date);
  return (index === -1 ? laid.length : index) - BETWEEN;
}

/** A part of a stand-in: a skill not outlined yet, as the run laid it. */
function isStandInPart(unit: Pick<QueueUnit, "kind" | "lessonId">): boolean {
  return unit.kind === "lesson" && unit.lessonId === null;
}

/**
 * An automatic run that plans a landing (see `findLanding`) laid the plan out as it was saved:
 * each landed skill's lessons now take its stand-in's time, in order, on the days it held, and
 * nothing else moves. When the run's cut left part of a skill out, its stand-in planned as many
 * lessons as its time holds at a lesson's estimate: more lessons than that stay out, as its cut
 * left them. Otherwise more lessons than its time holds go on the next days with room, as longer
 * ones do: a learn plan with no date left out the third lesson of a skill the graph sized at two.
 * What isn't written yet keeps the time after the lessons as a stand-in. A skill's first lesson
 * keeps its stand-in's day (today at the earliest) when its time starts later: Câmara's
 * linguistics base, placed where the week had time left, went two days after the first essay built
 * on it (R16, R41), and a stand-in Today showed left today's session (R7). Lessons that take longer than their stand-in's time never push a day
 * past the learner's time, or past what it held before when that was more: only the ones that
 * don't fit go on the next days with room, first on those days, past a challenge too (see
 * `findRoom`), and those no day by the goal's date has room for are left out for time (`leftOut`),
 * as a cut leaves lessons out. A day
 * the learner was already shown takes no more than it held. Put on the stand-in's first day
 * whatever their time, an ENEM plan's Friday went from 21 lessons to 44. `landed` is what falls
 * this week, which the run keeps as it is (see `keepThisWeek`), and `laidOut` the rest: a
 * landing-only run's only its landed skills' (see `kept`).
 */
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
  /** What the run's cut left out: a landed skill it cut part of gets no more than its time. */
  dropped?: readonly DroppedUnit[];
  input: BuildPlanInput;
  /**
   * A landing-only run's kept items but stand-ins, on the days they're saved for (see
   * `listKeptTime`): what each day holds is theirs, with the other stand-ins' parts as the run
   * laid them. Laid out again, an earlier run's plan put less on a Câmara plan's Saturday than it
   * held, and its landed lessons took it from 70 minutes to 130.
   */
  kept?: readonly KeptTime[] | null;
  /** This week's kept work as a run that laid the rest out again first laid it (see `layOutAfterThisWeek`). */
  keptParts: readonly ScheduledUnit[];
  landed: LandedUnits | null;
  start: Date;
  /** The run's layout. */
  units: readonly ScheduledUnit[];
}): { laidOut: ScheduledUnit[]; landed: ScheduledUnit[]; leftOut: DroppedUnit[] } {
  // A landing-only run's layout only says where its stand-ins' time was: the rest stays as the
  // plan has it.
  if (!landed || landed.size === 0) {
    return { laidOut: kept ? [] : [...units], landed: [], leftOut: [] };
  }

  const isPart = (unit: ScheduledUnit) => isStandInPart(unit) && landed.has(unit.skillId ?? "");

  // Laid out again from the week after, a run leaves this week's stand-ins out: their time is
  // where the first layout put it.
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
    ? [...kept, ...laid.filter((unit) => isStandInPart(unit) && !isPart(unit))]
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
    // A day takes no more than the learner's time, or what it held before when that was more; a
    // day the learner was shown, no more than it held. A landing-only run's stand-ins held time
    // only where it laid them, not where the plan kept its items: no day goes past the learner's
    // time but by what the plan already holds there.
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

  // What isn't written yet stays one stand-in: this week's whole when it begins in it.
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
    laidOut: all.filter((unit) => !isThisWeek(unit) && (!kept || ours.has(unit))),
    landed: all.filter((unit) => isThisWeek(unit)),
    leftOut: skills.flatMap((skill) =>
      skill.leftOut.map((unit) => ({ ...unit, fittedMinutes: 0 })),
    ),
  };
}
