import { MemoryCategory } from "@zoonk/db";
import { type AgeGroup } from "@zoonk/utils/age";

export type AgeProtections = {
  marketingEmailAllowed: boolean;
  /** The memory categories tasks may store and read for this learner. */
  memoryCategories: MemoryCategory[];
  sessionReplayAllowed: boolean;
};

/** Minors' memory keeps only what helps them learn, never their life outside it. */
const LEARNING_MEMORY_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.goals,
  MemoryCategory.learning,
];

/**
 * The most protective settings apply to everyone under 18 and to anyone who hasn't told us their
 * age yet, as ECA Digital asks of services minors are likely to use. Adults get the full product.
 */
export function getProtectionsForAgeGroup(ageGroup: AgeGroup): AgeProtections {
  if (ageGroup === "adult") {
    return {
      marketingEmailAllowed: true,
      memoryCategories: Object.values(MemoryCategory),
      sessionReplayAllowed: true,
    };
  }

  return {
    marketingEmailAllowed: false,
    memoryCategories: LEARNING_MEMORY_CATEGORIES,
    sessionReplayAllowed: false,
  };
}
