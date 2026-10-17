/**
 * The fields practice can be set in, as shareable keys: a learner's own words ("ICU nurse at a
 * hospital in Recife") become one of these, so every nurse shares the same nursing questions and
 * nothing personal reaches shared content. Keys are English slugs, the same in every language,
 * since items and versions are already stored per language.
 */
export const WORK_FIELDS = [
  "accounting",
  "agriculture",
  "architecture",
  "arts-and-culture",
  "aviation",
  "banking",
  "beauty-and-wellness",
  "construction",
  "consulting",
  "customer-service",
  "cybersecurity",
  "data-analysis",
  "dentistry",
  "design",
  "education",
  "energy",
  "engineering",
  "entrepreneurship",
  "environment",
  "finance",
  "food-service",
  "government",
  "healthcare",
  "hospitality",
  "human-resources",
  "insurance",
  "it-support",
  "journalism-and-media",
  "law",
  "logistics",
  "manufacturing",
  "marketing",
  "medicine",
  "nursing",
  "nutrition",
  "office-administration",
  "pharmacy",
  "physiotherapy",
  "product-management",
  "project-management",
  "psychology",
  "public-safety",
  "real-estate",
  "research",
  "retail",
  "sales",
  "social-work",
  "software-development",
  "sports-and-fitness",
  "veterinary",
  "writing-and-content",
] as const;

export type WorkField = (typeof WORK_FIELDS)[number];

export function isWorkField(value: unknown): value is WorkField {
  return WORK_FIELDS.some((field) => field === value);
}
