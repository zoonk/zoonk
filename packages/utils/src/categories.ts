export const COURSE_CATEGORIES = [
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

export function isValidCategory(category: unknown): category is CourseCategory {
  return typeof category === "string" && COURSE_CATEGORY_SET.has(category);
}
