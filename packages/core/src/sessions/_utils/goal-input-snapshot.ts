import { isDeepStrictEqual } from "node:util";
import { type Goal } from "@zoonk/db";

/** The goal fields that selection and the session builder consume, including their local-day basis. */
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

/** A newer plan version cannot make an older caller's goal snapshot safe to commit. */
export function hasSameGoalInputs({
  current,
  planned,
}: {
  current: Goal | null;
  planned: Goal;
}): boolean {
  return current !== null && isDeepStrictEqual(goalInputs(current), goalInputs(planned));
}
