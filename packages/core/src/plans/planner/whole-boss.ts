import { EPSILON, findDayIndex, findDayIndexFrom, findLessonDayFrom } from "./day-index";
import { type ExistingPlanItem } from "./plan-items";
import { type QueueUnit } from "./plan-units";
import { type PlanDay } from "./schedule-units";

/**
 * Where a phase's challenge goes (see `placeUnits`): `beside` when it sits right after the
 * lessons it tests on their own day, taking none of the day's lesson time.
 */
export type PlacedBoss = { beside: boolean; dayIndex: number; start: number; used: number };

/**
 * A phase's challenge on the first study day after the lessons before it (where the time they
 * take ends, `used`), so a day passes between learning and being tested: a day with lesson time
 * (see `canHoldPhaseChallenge`), never one whose minutes all go to fixed events. It leads that
 * day, and what the day has left goes to the work after it; longer than the day, it takes it all,
 * past the day's time, never two (its day asks for it, see `getPlannedMinutes`). One right after
 * another shares its day. With no study day left before the plan's end, it comes right after its
 * lessons on their last day, beside them. A kept phase end's challenge leads its kept day
 * (`heldOn`). Null for any other unit.
 */
export function placeBoss({
  cumulative,
  from,
  previous,
  unit,
  used,
}: {
  cumulative: readonly number[];
  /** The day the unit before it is due on: no day before it can hold this one. */
  from: number;
  /** The challenge right before this one, when this one follows it. */
  previous: PlacedBoss | null;
  unit: QueueUnit;
  /** Where the time the units before it take ends. */
  used: number;
}): PlacedBoss | null {
  if (unit.kind !== "boss") {
    return null;
  }

  const lead = (dayIndex: number, start: number): PlacedBoss => {
    const dayEnd = cumulative[dayIndex] ?? start;
    const end = start + unit.minutes;

    return {
      beside: false,
      dayIndex,
      start,
      used: Math.max(used, end <= dayEnd + EPSILON ? end : dayEnd),
    };
  };

  if (unit.heldOn !== undefined) {
    return lead(unit.heldOn, unit.startsAt ?? cumulative[unit.heldOn - 1] ?? 0);
  }

  // No sooner than the day after the lessons the run keeps as they are (`afterDay`).
  const afterDay = unit.afterDay ?? -1;

  if (previous && previous.dayIndex > afterDay) {
    return previous.beside ? { ...previous, start: used, used } : lead(previous.dayIndex, used);
  }

  const floor = Math.max(used, cumulative[afterDay] ?? 0);

  // The next study day starts where the day `floor` reaches into ends.
  const reached = floor <= EPSILON ? -1 : findDayIndex({ cumulative, needed: floor });
  const lastDay = Math.max(reached, afterDay);
  const start = lastDay === -1 ? floor : Math.max(floor, cumulative[lastDay] ?? floor);

  const covered = findDayIndexFrom({
    cumulative,
    from: Math.max(0, from, afterDay + 1),
    needed: start + 2 * EPSILON,
  });

  const next = findLessonDayFrom({ cumulative, from: covered });

  // Its minutes come from its own day's lesson time, never from the days it skipped.
  if (next !== -1) {
    return lead(next, Math.max(start, cumulative[next - 1] ?? 0));
  }

  return { beside: true, dayIndex: lastDay, start: floor, used: floor };
}

/**
 * The challenges among `units` with the day of the latest lesson the run keeps as it is (`after`)
 * as a place in these days (`afterDay`): they come on a study day after it.
 */
export function withKeptLessons({
  days,
  units,
}: {
  days: readonly PlanDay[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  return units.map((unit) => {
    if (unit.kind !== "boss" || !unit.after || unit.heldOn !== undefined) {
      return unit;
    }

    const after = unit.after.getTime();
    return { ...unit, afterDay: days.findLastIndex((item) => item.date.getTime() <= after) };
  });
}

const LEARN_KINDS = new Set<ExistingPlanItem["kind"]>(["chapter", "lesson"]);

type KeptLesson = Pick<ExistingPlanItem, "kind" | "phase" | "scheduledFor"> &
  Partial<Pick<ExistingPlanItem, "completedAt" | "id" | "status">>;

/**
 * The day a lesson the run keeps was taught: a finished one's, the day the learner did it (see
 * `BuildPlanInput.finishedOn`), early or late; one finished before that was saved, the run's day
 * at the latest; any other, its day in the plan.
 */
function getTaughtDay({
  input,
  item,
}: {
  input: { finishedOn?: ReadonlyMap<string, Date>; today?: Date };
  item: KeptLesson;
}): Date | null {
  const { scheduledFor, today } = { ...item, ...input };
  const finished = item.status === "done" && item.id ? input.finishedOn?.get(item.id) : undefined;

  if (finished || item.status !== "done" || item.completedAt || !scheduledFor || !today) {
    return finished ?? scheduledFor;
  }

  return today < scheduledFor ? today : scheduledFor;
}

/**
 * The challenges among `units` with the day of the latest lesson of their phase or an earlier one
 * that the run keeps as it is or lays out ahead of them (`kept`: done, this week's, what earlier days
 * left): a challenge comes after the day it was taught (see `getTaughtDay`), as after the lessons it
 * lays out (see `withKeptLessons`). Pedro finished Friday's lesson on Monday, and its challenge
 * waited until Saturday; dated by the run's day instead, it moved a day later every day.
 */
export function markKeptLessons({
  input = {},
  kept,
  units,
}: {
  /** The day each finished lesson was done, and the run's day. */
  input?: { finishedOn?: ReadonlyMap<string, Date>; today?: Date };
  kept: readonly KeptLesson[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const lessons = kept.flatMap((item) => {
    const scheduledFor = LEARN_KINDS.has(item.kind) ? getTaughtDay({ input, item }) : null;
    return scheduledFor ? [{ ...item, scheduledFor }] : [];
  });

  return units.map((unit) => {
    if (unit.kind !== "boss") {
      return unit;
    }

    const after = lessons
      .filter((item) => item.phase <= unit.phase)
      .reduce<Date | undefined>(
        (latest, item) =>
          item.scheduledFor && (!latest || item.scheduledFor > latest) ? item.scheduledFor : latest,
        unit.after,
      );

    return after ? { ...unit, after } : unit;
  });
}
