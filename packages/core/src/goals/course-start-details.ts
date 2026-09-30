import { isJsonObject } from "@zoonk/utils/json";

/** A goal started from a Library course's page (or one of its chapters), in the goal's details. */
export type CourseStart = { chapterId: string | null };

/**
 * The course start a goal records: onboarding asks nothing the course already answers, and a
 * chapter start also skips the level and placement, since the learner chose where to begin.
 * Null for goals typed or started any other way.
 */
export function readCourseStart(details: Record<string, unknown>): CourseStart | null {
  const start = details.courseStart;

  if (!isJsonObject(start)) {
    return null;
  }

  return { chapterId: typeof start.chapterId === "string" ? start.chapterId : null };
}
