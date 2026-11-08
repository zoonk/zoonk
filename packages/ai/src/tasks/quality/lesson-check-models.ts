import { pickReviewers } from "../../_utils/model-family";
import { type CallReuse } from "../../provider-options";

/**
 * Catching every real error matters most: on 31 cases (8 Nov 2026), Sonnet 5.5 blocked all 22
 * planted mistakes (EN 100%, PT 94.1%) at $29.70/1k. For a lesson Opus wrote, Sol (21 of 22,
 * $13.36/1k) beats Gemini 3.8 Flash (20, $11.27/1k), though both miss the 85% floor.
 */
const REUSED_LESSON_REVIEWERS = [
  "anthropic/claude-sonnet-5.5",
  "openai/gpt-6.1-sol",
  "google/gemini-3.8-flash",
] as const;

/**
 * A lesson one learner reads still can't teach a false rule: Gemini 3.8 Flash, at 38% of Sonnet's
 * cost, passed a summary saying quantities are proportional whenever they move together.
 */
const ONE_LEARNER_LESSON_REVIEWERS = [
  "anthropic/claude-sonnet-5.5",
  "google/gemini-3.8-flash",
  "openai/gpt-6.1-sol",
] as const;

export function getLessonCheckModels({
  reuse,
  writerModel,
}: {
  reuse: CallReuse;
  writerModel: string;
}): { fallbackModels: string[]; model: string } {
  return pickReviewers({
    reviewers: reuse === "bounded" ? REUSED_LESSON_REVIEWERS : ONE_LEARNER_LESSON_REVIEWERS,
    writerModel,
  });
}
