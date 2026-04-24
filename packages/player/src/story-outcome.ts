import { type StoryAlignment } from "@zoonk/core/steps/contract/content";
import { type StoryOutcomeTier } from "@zoonk/utils/activities";

const PERFECT_OUTCOME_SCORE = 1;
const GOOD_OUTCOME_SCORE = 0.75;
const OK_OUTCOME_SCORE = 0.45;

const STORY_ALIGNMENT_SCORE: Record<StoryAlignment, number> = {
  partial: 1,
  strong: 2,
  weak: 0,
};

const FALLBACK_STORY_OUTCOME_TIER = "terrible" satisfies StoryOutcomeTier;

const STRONG_ALIGNMENT_SCORE = STORY_ALIGNMENT_SCORE.strong;

/**
 * Converts selected story alignments into the fixed outcome tier. The AI
 * writes tier narratives, but the app owns this scoring rule so endings stay
 * consistent across every generated story.
 */
function getStoryOutcomeTier(alignments: StoryAlignment[]): StoryOutcomeTier | null {
  if (alignments.length === 0) {
    return null;
  }

  const score =
    alignments.reduce((sum, alignment) => sum + STORY_ALIGNMENT_SCORE[alignment], 0) /
    (alignments.length * STRONG_ALIGNMENT_SCORE);

  if (score === PERFECT_OUTCOME_SCORE) {
    return "perfect";
  }

  if (score >= GOOD_OUTCOME_SCORE) {
    return "good";
  }

  if (score >= OK_OUTCOME_SCORE) {
    return "ok";
  }

  if (score > 0) {
    return "bad";
  }

  return "terrible";
}

/**
 * Returns the outcome tier that the player can safely render.
 *
 * A valid generated story has at least one decision, but stale or malformed
 * saved steps can still leave the outcome screen with no alignments to score.
 * In that case the player shows the weakest authored ending so the learner
 * still sees content and gets the Continue action instead of a blank screen.
 */
export function getStoryOutcomeDisplayTier(alignments: StoryAlignment[]): StoryOutcomeTier {
  return getStoryOutcomeTier(alignments) ?? FALLBACK_STORY_OUTCOME_TIER;
}
