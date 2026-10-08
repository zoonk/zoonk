/** Level bands of a Library course, matching the `CourseLevel` database enum. */
export const COURSE_LEVELS = ["overview", "beginner", "intermediate", "advanced"] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number];
