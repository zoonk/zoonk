import { findLanguageFlaws } from "@zoonk/utils/language-flaws";

/**
 * Code can't put back the accents a model dropped or replace a word it slipped in from another
 * alphabet, so the output is thrown away for another run, like any answer that fails its checks.
 */
export function assertLearnerLanguage(params: Parameters<typeof findLanguageFlaws>[0]): void {
  const problems = findLanguageFlaws(params);

  if (problems.length > 0) {
    throw new Error(`AI provider misspelled the learner's language: ${problems.join(" ")}`);
  }
}
