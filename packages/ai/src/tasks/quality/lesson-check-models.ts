import { pickReviewers } from "../../_utils/model-family";

// On 26 real lessons (8 Nov 2026), Astra caught 6/6 confirmed errors without false flags at
// $0.037/review on flex; Sol caught 4, Opus 2. Argon caught none and 2/4 flags broke a correct
// citation; Flash passed 24/25 in production. No other-provider fallback for Opus-written
// lessons: the evaluated alternatives made things worse.
// The six real-case rerun caught all six errors with Astra ($0.5183/6); Sol missed the
// summary error and the ordering activity ($0.1009/6), while both kept the correct citation.
const WRITTEN_REVIEWERS = [
  "openai/gpt-6-astra",
  "openai/gpt-6.1-sol",
  "anthropic/claude-opus-5.5",
] as const;

// Alphabet lessons retain the evaluated chain: Sonnet caught all 20 planted errors (9 Oct 2026).
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
