import { isJsonObject } from "@zoonk/utils/json";

export type CourseStart = { chapterId: string | null; dailyMinutes?: number };

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
