import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { daysBetween } from "../../plans/planner/plan-calendar";

/** Whole days since the goal was created in the learner's zone: 0 on its first day. */
export function getGoalDay({
  createdAt,
  localDate,
  timeZone,
}: {
  createdAt: Date;
  localDate: Date;
  timeZone: string;
}): number {
  return daysBetween(getDateInTimeZone({ date: createdAt, timeZone }), localDate);
}
