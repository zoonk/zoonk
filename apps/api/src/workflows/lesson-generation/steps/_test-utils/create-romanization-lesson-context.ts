import { type RomanizationStepContext } from "../_utils/romanization-step-context";

/**
 * Creates the smallest lesson context needed by romanization step tests.
 * These steps only inspect the target language, so avoiding database fixtures
 * keeps the tests focused on the stream contract instead of Prisma setup.
 */
export function createRomanizationLessonContext({
  targetLanguage,
}: {
  targetLanguage: string | null;
}): RomanizationStepContext {
  return { chapter: { course: { targetLanguage } } };
}
