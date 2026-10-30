/**
 * A learner's own words become one of these, so nothing personal reaches shared content. English
 * slugs in every language, since items are already stored per language.
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
