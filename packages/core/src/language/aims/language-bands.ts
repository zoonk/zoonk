import { type CourseLevel } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { LANGUAGE_AIMS } from "./language-aims";

/** A language graph files A1 and A2 situations as beginner, B1 and B2 intermediate, C1 and C2 advanced. */
export const AIM_BANDS: Readonly<Record<CefrLevel, CourseLevel>> = {
  A1: "beginner",
  A2: "beginner",
  B1: "intermediate",
  B2: "intermediate",
  C1: "advanced",
  C2: "advanced",
};

const AIMED_BANDS = [...new Set(LANGUAGE_AIMS.map((aim) => AIM_BANDS[aim]))];

/**
 * Learners share a language graph whatever level they aim for, so it needs situations in every
 * band an aim reaches; otherwise that band's hours have nothing to plan.
 */
export function findMissingLanguageBands(skills: readonly { level: CourseLevel }[]): CourseLevel[] {
  const written = new Set(skills.map((skill) => skill.level));
  return AIMED_BANDS.filter((band) => !written.has(band));
}
