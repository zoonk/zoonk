import { findDayIndex, findDayIndexFrom, findLessonDayFrom } from "./day-index";
import { LEARN_KINDS } from "./plan-item-rules";
import { type ExistingPlanItem } from "./plan-items";
import { PLAN_EPSILON } from "./plan-precision";
import { type QueueUnit } from "./plan-units";
import { type PlanDay } from "./schedule-units";

export type PlacedBoss = { beside: boolean; dayIndex: number; start: number; used: number };

function leadDay({
  cumulative,
  dayIndex,
  minutes,
  start,
  used,
}: {
  cumulative: readonly number[];
  dayIndex: number;
  minutes: number;
  start: number;
  used: number;
}): PlacedBoss {
  const dayEnd = cumulative[dayIndex] ?? start;
  const end = start + minutes;

  return {
    beside: false,
    dayIndex,
    start,
    used: Math.max(used, end <= dayEnd + PLAN_EPSILON ? end : dayEnd),
  };
}

export function placeBoss({
  cumulative,
  from,
  previous,
  unit,
  used,
}: {
  cumulative: readonly number[];
  from: number;
  previous: PlacedBoss | null;
  unit: QueueUnit;
  used: number;
}): PlacedBoss | null {
  if (unit.kind !== "boss") {
    return null;
  }

  const lead = (dayIndex: number, start: number) =>
    leadDay({ cumulative, dayIndex, minutes: unit.minutes, start, used });

  if (unit.heldOn !== undefined) {
    const start = unit.startsAt ?? cumulative[unit.heldOn - 1] ?? 0;

    // A challenge held on the day the learner saw keeps it while the work before it ends by then.
    // When an earlier phase's challenge reaches that day, this one goes after it (R39).
    if (used <= start + PLAN_EPSILON) {
      return lead(unit.heldOn, start);
    }
  }

  const afterDay = unit.afterDay ?? -1;

  if (previous && previous.dayIndex > afterDay) {
    return previous.beside ? { ...previous, start: used, used } : lead(previous.dayIndex, used);
  }

  const floor = Math.max(used, cumulative[afterDay] ?? 0);

  const reached = floor <= PLAN_EPSILON ? -1 : findDayIndex({ cumulative, needed: floor });

  // Past the plan's last day, it's left out with the work before it: the day of the lessons it tests
  // would put it first (day one, when placement found them known).
  if (reached === -1 && floor > PLAN_EPSILON) {
    return { beside: true, dayIndex: -1, start: floor, used: floor };
  }

  const lastDay = Math.max(reached, afterDay);
  const start = lastDay === -1 ? floor : Math.max(floor, cumulative[lastDay] ?? floor);

  const covered = findDayIndexFrom({
    cumulative,
    from: Math.max(0, from, afterDay + 1),
    needed: start + 2 * PLAN_EPSILON,
  });

  const next = findLessonDayFrom({ cumulative, from: covered });

  if (next !== -1) {
    return lead(next, Math.max(start, cumulative[next - 1] ?? 0));
  }

  return { beside: true, dayIndex: lastDay, start: floor, used: floor };
}

/**
 * Records the minutes `boss` runs past its day in `pastDays`. A day runs past the learner's time by
 * one challenge at most, so another goes on the next study day, or is left out (day -1) when none
 * is left.
 */
export function keepDayOverrun({
  boss,
  cumulative,
  state,
  unit,
}: {
  boss: PlacedBoss;
  cumulative: readonly number[];
  state: { pastDays: Map<number, number>; used: number };
  unit: QueueUnit;
}): PlacedBoss {
  const { pastDays, used } = state;

  const past = boss.beside
    ? unit.minutes
    : Math.max(0, boss.start + unit.minutes - (cumulative[boss.dayIndex] ?? 0));

  const before = pastDays.get(boss.dayIndex) ?? 0;

  if (before + past > unit.minutes + PLAN_EPSILON) {
    const next = findLessonDayFrom({ cumulative, from: boss.dayIndex + 1 });

    if (next === -1) {
      return { ...boss, dayIndex: -1, used };
    }

    const start = Math.max(used, cumulative[next - 1] ?? 0);
    const moved = leadDay({ cumulative, dayIndex: next, minutes: unit.minutes, start, used });

    return keepDayOverrun({ boss: moved, cumulative, state, unit });
  }

  if (boss.dayIndex >= 0 && past > 0) {
    pastDays.set(boss.dayIndex, before + past);
  }

  return boss;
}

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

type KeptLesson = Pick<ExistingPlanItem, "kind" | "phase" | "scheduledFor"> &
  Partial<Pick<ExistingPlanItem, "completedAt" | "id" | "status">>;

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

export function markKeptLessons({
  input = {},
  kept,
  units,
}: {
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
