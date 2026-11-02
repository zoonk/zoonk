import { type GoalKind } from "@zoonk/db";

export function isResearchedGoalKind(kind: GoalKind): boolean {
  return kind === "exam" || kind === "learn";
}

export function isResearchedCourseStart(goal: {
  examBlueprintId: string | null;
  kind: GoalKind;
}): boolean {
  return goal.kind === "exam" && !goal.examBlueprintId;
}
