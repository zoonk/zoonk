import { isStandInUnit } from "./plan-item-rules";
import { PLAN_EPSILON } from "./plan-precision";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, scheduleUnits } from "./schedule-units";

type ScheduleInput = { days: readonly PlanDay[]; units: readonly QueueUnit[] };

function placeUntilHorizon({ days, units }: ScheduleInput) {
  const schedule = scheduleUnits({ days, preserveWork: true, units });
  const [boundary] = schedule.dropped;

  if (!boundary || !isStandInUnit(boundary) || !boundary.lessons || boundary.minutes <= 0) {
    return schedule;
  }

  const perLesson = boundary.minutes / boundary.lessons;
  const count = Math.floor((boundary.fittedMinutes + PLAN_EPSILON) / perLesson);

  if (count < 1 || count >= boundary.lessons) {
    return schedule;
  }

  const partial = { lessons: count, minutes: perLesson * count };

  const remainder = {
    lessons: boundary.lessons - count,
    minutes: boundary.minutes - partial.minutes,
  };

  return scheduleUnits({
    days,
    preserveWork: true,
    units: units.flatMap((unit) =>
      unit.key === boundary.key && unit.lessons === boundary.lessons
        ? [
            { ...unit, ...partial },
            { ...unit, ...remainder },
          ]
        : [unit],
    ),
  });
}

export function scheduleUndated(input: ScheduleInput) {
  const schedule = placeUntilHorizon(input);
  return { ...schedule, dropped: schedule.dropped.map((unit) => ({ ...unit, fittedMinutes: 0 })) };
}
