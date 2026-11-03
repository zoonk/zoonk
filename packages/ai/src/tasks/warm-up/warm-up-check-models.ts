import { pickReviewers } from "../../_utils/model-family";

/**
 * On the warm-up-check eval (3 Nov 2026), Gemini 3.8 Flash caught all 13 planted errors and kept
 * all 53 clean cards; a check reads about 1,900 tokens and writes 300 in 5 s for $0.0025. Four of
 * those errors repeat or give away an earlier card, which all three reviewers kept until the prompt
 * asked them to read the deck in order. Luna and Sonnet 5.5 still miss one of the four in some runs
 * (Luna 14 of 16 over four runs), a card the learner already knows rather than a false one; each
 * kept 51 clean cards, Luna at $0.0005 and Sonnet at $0.008. Haiku 5.5 and Flash Lite let a second
 * right answer through.
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
