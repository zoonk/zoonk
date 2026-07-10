const COURSE_CATEGORIES = [
  "arts",
  "business",
  "communication",
  "culture",
  "economics",
  "engineering",
  "geography",
  "health",
  "history",
  "languages",
  "law",
  "math",
  "science",
  "society",
  "tech",
] as const;

const COURSE_CATEGORY_SET: ReadonlySet<string> = new Set(COURSE_CATEGORIES);

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];
export type AICourseCategory = Exclude<CourseCategory, "languages">;

export const AI_COURSE_CATEGORIES: readonly AICourseCategory[] = COURSE_CATEGORIES.filter(
  (category): category is AICourseCategory => category !== "languages",
);

const AI_COURSE_CATEGORY_SET: ReadonlySet<string> = new Set(AI_COURSE_CATEGORIES);

/** Checks whether an unknown value belongs to the complete course taxonomy. */
export function isValidCategory(category: unknown): category is CourseCategory {
  return typeof category === "string" && COURSE_CATEGORY_SET.has(category);
}

/**
 * Checks whether an unknown value can be assigned by the course-category model.
 * Language courses receive `languages` through deterministic product logic, so
 * that category must not be accepted from model output or eval fixtures.
 */
export function isAICourseCategory(category: unknown): category is AICourseCategory {
  return typeof category === "string" && AI_COURSE_CATEGORY_SET.has(category);
}
