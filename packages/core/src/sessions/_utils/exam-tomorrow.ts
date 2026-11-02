import { type Goal } from "@zoonk/db";
import { getDaysToExam } from "../../exams/final-stretch/final-stretch-rules";

/** The exam eve has no later study day, so never promise work will return tomorrow. */
export function isExamTomorrow({
  day,
  goal,
}: {
  day: Date;
  goal: Pick<Goal, "kind" | "targetDate"> | null;
}): boolean {
  return goal?.kind === "exam" && getDaysToExam({ targetDate: goal.targetDate, today: day }) === 1;
}
