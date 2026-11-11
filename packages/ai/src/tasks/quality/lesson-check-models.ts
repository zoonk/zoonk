import { pickReviewers } from "../../_utils/model-family";

/**
 * On 18 cases (11 Nov 2026), Astra caught all six confirmed errors, Fable two and Carbon five,
 * at $66, $106 and $62 per 1k eval reviews; Carbon also flagged a clean control. Argon caught none
 * in the 8 Nov audit, so an Opus-written lesson still has no reliable fallback outside OpenAI.
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
