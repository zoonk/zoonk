import { isDeepStrictEqual } from "node:util";
import { type Goal } from "@zoonk/db";

function goalInputs(goal: Goal) {
  return {
    createdAt: goal.createdAt,
    dailyMinutes: goal.dailyMinutes,
    details: goal.details,
    examBlueprintId: goal.examBlueprintId,
    id: goal.id,
    kind: goal.kind,
    language: goal.language,
    primaryCourseId: goal.primaryCourseId,
    status: goal.status,
    targetDate: goal.targetDate,
    targetLanguage: goal.targetLanguage,
    timezone: goal.timezone,
    userId: goal.userId,
  };
}

/** A newer plan version cannot authorize committing against an older goal-input snapshot. */
export function hasSameGoalInputs({
  current,
  planned,
}: {
  current: Goal | null;
  planned: Goal;
}): boolean {
  return current !== null && isDeepStrictEqual(goalInputs(current), goalInputs(planned));
}
