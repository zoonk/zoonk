/** Matches the `CourseLevel` database enum. */
export const COURSE_LEVELS = ["overview", "beginner", "intermediate", "advanced"] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number];

/** Learners at these levels meet the subject for the first time, so lessons show more and ask less. */
export function isNoviceLevel(level: CourseLevel): boolean {
  return level === "overview" || level === "beginner";
}
