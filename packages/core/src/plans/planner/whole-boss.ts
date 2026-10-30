import { findDayIndex, findDayIndexFrom, findLessonDayFrom } from "./day-index";
import { LEARN_KINDS } from "./plan-item-rules";
import { type ExistingPlanItem } from "./plan-items";
import { PLAN_EPSILON } from "./plan-precision";
import { type QueueUnit } from "./plan-units";
import { type PlanDay } from "./schedule-units";

export type PlacedBoss = { beside: boolean; dayIndex: number; start: number; used: number };

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

  const lead = (dayIndex: number, start: number): PlacedBoss => {
    const dayEnd = cumulative[dayIndex] ?? start;
    const end = start + unit.minutes;

    return {
      beside: false,
      dayIndex,
      start,
      used: Math.max(used, end <= dayEnd + PLAN_EPSILON ? end : dayEnd),
    };
  };

  if (unit.heldOn !== undefined) {
    return lead(unit.heldOn, unit.startsAt ?? cumulative[unit.heldOn - 1] ?? 0);
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
