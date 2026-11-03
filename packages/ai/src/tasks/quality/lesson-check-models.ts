import { pickReviewers } from "../../_utils/model-family";
import { type CallReuse } from "../../provider-options";

/**
 * Catching every real error matters most on a lesson many learners read: Sonnet 5.5 blocked all 20
 * planted mistakes on the lesson-quality-check eval (9 Oct 2026). Gemini 3.8 Flash let an
 * over-broad summary through, and Haiku blocked clean lessons, which costs fix passes.
 */
const REUSED_LESSON_REVIEWERS = [
  "anthropic/claude-sonnet-5.5",
  "google/gemini-3.8-flash",
  "openai/gpt-6.1-sol",
] as const;

/**
 * Gemini 3.8 Flash caught all 14 planted mistakes at about 40% of Sonnet's price (7 Oct 2026). A
 * lesson Gemini wrote gets the next reviewer from another family.
 */
const ONE_LEARNER_LESSON_REVIEWERS = [
  "google/gemini-3.8-flash",
  "anthropic/claude-sonnet-5.5",
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
