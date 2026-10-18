import { type Goal } from "@zoonk/db";
import { getDaysToExam } from "../../exams/final-stretch/final-stretch-rules";

/**
 * Whether a goal's exam is the day after `day`: `day` is its last study day, so nothing of the goal
 * comes back tomorrow (a lesson, a saved mistake, the lessons to catch up). Pedro's day before told
 * him all three came "tomorrow", his test's day.
 */
export function isExamTomorrow({
  day,
  goal,
}: {
  day: Date;
  goal: Pick<Goal, "kind" | "targetDate"> | null;
}): boolean {
  return goal?.kind === "exam" && getDaysToExam({ targetDate: goal.targetDate, today: day }) === 1;
}
