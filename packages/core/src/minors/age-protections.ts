import { MemoryCategory } from "@zoonk/db";
import { type AgeGroup } from "@zoonk/utils/age";

export type AgeProtections = {
  marketingEmailAllowed: boolean;
  /** The memory categories tasks may store and read for this learner. */
  memoryCategories: MemoryCategory[];
  /** Whether memory is on until the learner chooses. Only adults start with it on. */
  memoryOnByDefault: boolean;
  sessionReplayAllowed: boolean;
};

/** Minors' memory keeps only what helps them learn, never their life outside it. */
const LEARNING_MEMORY_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.goals,
  MemoryCategory.learning,
];

/**
 * The most protective settings apply to everyone under 18 and to anyone who hasn't told us their
 * age yet, as ECA Digital asks of services minors are likely to use (art. 7: the most protective
 * setting by default). Memory profiles how someone learns and the product works without it, so it
 * starts off for them until they turn it on (also the UK Children's code, standards 7 and 12).
 * Adults get the full product.
 */
export function getProtectionsForAgeGroup(ageGroup: AgeGroup): AgeProtections {
  if (ageGroup === "adult") {
    return {
      marketingEmailAllowed: true,
      memoryCategories: Object.values(MemoryCategory),
      memoryOnByDefault: true,
      sessionReplayAllowed: true,
    };
  }

  return {
    marketingEmailAllowed: false,
    memoryCategories: LEARNING_MEMORY_CATEGORIES,
    memoryOnByDefault: false,
    sessionReplayAllowed: false,
  };
}
