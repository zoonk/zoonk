import { type GoalView } from "@zoonk/core/goals/contract";

export function getGoalSubject(goal: Pick<GoalView, "details" | "displayName">): string {
  const subject = goal.details.subject;
  return typeof subject === "string" && subject.trim() ? subject : goal.displayName;
}
