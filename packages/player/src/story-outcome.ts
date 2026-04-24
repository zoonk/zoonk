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

const STRONG_ALIGNMENT_SCORE = STORY_ALIGNMENT_SCORE.strong;

/**
 * Converts selected story alignments into the fixed outcome tier. The AI
 * writes tier narratives, but the app owns this scoring rule so endings stay
 * consistent across every generated story.
 */
export function getStoryOutcomeTier(alignments: StoryAlignment[]): StoryOutcomeTier | null {
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
