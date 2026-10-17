import { getBaseLanguage } from "@zoonk/utils/languages";

/**
 * One alphabet lesson per script and learner language: its identity is the target language, and
 * the lesson's own language (the learner's) keeps each pair apart.
 */
export function getAlphabetIdentityKey(targetLanguage: string): string {
  return `alphabet:${getBaseLanguage(targetLanguage)}`;
}
