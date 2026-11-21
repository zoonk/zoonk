import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

export type CourseStart = { chapterId: string | null; dailyMinutes?: number };

/** A next level keeps its original start address, but follows its resolved course's outline. */
export function unpinnedCourseSourceId(goal: Pick<Goal, "replacesGoalId" | "sourceCourseId">) {
  return goal.replacesGoalId ? null : goal.sourceCourseId;
}

export function readCourseStart(details: Record<string, unknown>): CourseStart | null {
  const start = details.courseStart;

  if (!isJsonObject(start)) {
    return null;
  }

  return {
    chapterId: typeof start.chapterId === "string" ? start.chapterId : null,
    ...(typeof start.dailyMinutes === "number" && { dailyMinutes: start.dailyMinutes }),
  };
}
