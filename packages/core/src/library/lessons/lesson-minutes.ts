import { LANGUAGE_LESSON_TIME_FACTOR } from "../../plans/planner/plan-pace";
import { ALPHABET_IDENTITY_PREFIX } from "../language/alphabet/alphabet-identity";

export function getDefaultLessonMinutes({
  estimatedMinutes,
  identityKey,
  targetLanguage,
}: {
  estimatedMinutes: number;
  identityKey: string;
  targetLanguage: string | null;
}): number {
  if (targetLanguage === null || identityKey.startsWith(ALPHABET_IDENTITY_PREFIX)) {
    return estimatedMinutes;
  }

  return Math.max(1, Math.round(estimatedMinutes * LANGUAGE_LESSON_TIME_FACTOR));
}
