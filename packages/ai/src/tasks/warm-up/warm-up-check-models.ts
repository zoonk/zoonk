import { pickReviewers } from "../../_utils/model-family";

/**
 * On the warm-up-check eval (11 Nov 2026), Gemini 3.8 Flash at medium reasoning caught every
 * planted error and kept every clean card on all 9 cases, at 20 s p50 for about $0.009 a deck. At
 * low reasoning it keeps a reveal's false side detail ("the English word for that feeling is
 * 'avergonzada'"). Sonnet 5.5 at medium caught it too, as fast as Flash at low, but dropped a clean
 * card; Luna missed it at both efforts, so Sonnet reviews before Luna. Haiku 5.5 lets a second right
 * answer through, and Flash Lite and Muse Ember miss the false side detail. A deck is shared, and
 * in production it's saved about 18 s into a goal build, long before the plan it waits beside
 * (about 46 s for the skill graph), so the check can spend the time.
 */
const WARM_UP_REVIEWERS = [
  "google/gemini-3.8-flash",
  "anthropic/claude-sonnet-5.5",
  "openai/gpt-6-luna",
] as const;

export function getWarmUpCheckModels(writerModel: string): {
  fallbackModels: string[];
  model: string;
} {
  return pickReviewers({ reviewers: WARM_UP_REVIEWERS, writerModel });
}
