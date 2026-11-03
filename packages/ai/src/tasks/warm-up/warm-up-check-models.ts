import { pickReviewers } from "../../_utils/model-family";

/**
 * On the warm-up-check eval (3 Nov 2026), Gemini 3.8 Flash and Luna caught all 9 planted errors
 * and kept all 26 clean cards; a check reads about 2,100 tokens and writes 280 in 5 s for $0.0026.
 * Sonnet 5.5 also caught all 9 and kept 25, at $0.009. Haiku 5.5 and Flash Lite let a second right
 * answer through.
 */
const WARM_UP_REVIEWERS = [
  "google/gemini-3.8-flash",
  "openai/gpt-6-luna",
  "anthropic/claude-sonnet-5.5",
] as const;

export function getWarmUpCheckModels(writerModel: string): {
  fallbackModels: string[];
  model: string;
} {
  return pickReviewers({ reviewers: WARM_UP_REVIEWERS, writerModel });
}
