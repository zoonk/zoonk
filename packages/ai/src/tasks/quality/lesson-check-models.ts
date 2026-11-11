import { pickReviewers } from "../../_utils/model-family";

/**
 * On the 26 shared lessons Opus wrote on 8 Nov 2026, two blind judges confirmed 6 errors. Astra
 * found all 6 with no false flag at $0.037 a review on flex, Sol 4 and Opus 2. Gemini 4 Argon found
 * none and flagged a correct legal citation as wrong because the lesson plan had it wrong, and
 * Gemini 3.8 Flash, the reviewer before, passed 24 of those lessons. So an Opus-written lesson has
 * no fallback outside OpenAI: no other evaluated reviewer helped.
 */
const WRITTEN_REVIEWERS = [
  "openai/gpt-6-astra",
  "openai/gpt-6.1-sol",
  "anthropic/claude-opus-5.5",
] as const;

/** Luna writes alphabet lessons; Sonnet 5.5 blocked all 20 planted mistakes in the review eval (9 Oct 2026). */
const ALPHABET_REVIEWERS = [
  "anthropic/claude-sonnet-5.5",
  "google/gemini-3.8-flash",
  "openai/gpt-6.1-sol",
] as const;

export function getLessonCheckModels({
  alphabet = false,
  writerModel,
}: {
  alphabet?: boolean;
  writerModel: string;
}): { fallbackModels: string[]; model: string } {
  return pickReviewers({
    reviewers: alphabet ? ALPHABET_REVIEWERS : WRITTEN_REVIEWERS,
    writerModel,
  });
}
