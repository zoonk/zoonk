import { type StoryAlignment } from "@zoonk/core/steps/content-contract";
import { BRAIN_POWER_PER_ACTIVITY, STORY_BRAIN_POWER } from "@zoonk/utils/brain-power";
import { ENERGY_PER_CORRECT, ENERGY_PER_INCORRECT, ENERGY_PER_STATIC } from "@zoonk/utils/energy";

type ActivityScoreInput = {
  results: { isCorrect: boolean }[];
};

export type ScoreResult = {
  brainPower: number;
  correctCount: number;
  energyDelta: number;
  incorrectCount: number;
};

function calculateEnergyDelta(results: ActivityScoreInput["results"]): number {
  if (results.length === 0) {
    return ENERGY_PER_STATIC;
  }

  const correctCount = results.filter((result) => result.isCorrect).length;
  const incorrectCount = results.length - correctCount;
  return correctCount * ENERGY_PER_CORRECT + incorrectCount * ENERGY_PER_INCORRECT;
}

const STORY_ENERGY_BY_ALIGNMENT: Record<StoryAlignment, number> = {
  partial: 1,
  strong: 3,
  weak: 0,
};

/**
 * Compute score for a story activity based on choice alignments.
 *
 * Stories earn 100 BP on completion (vs 10 for standard activities).
 * Energy is alignment-based: strong (+3), partial (+1), weak (0).
 * Strong/partial count as correct; weak counts as incorrect for analytics.
 */
export function computeStoryScore({ alignments }: { alignments: StoryAlignment[] }): ScoreResult {
  const energyDelta = alignments.reduce(
    (sum, alignment) => sum + STORY_ENERGY_BY_ALIGNMENT[alignment],
    0,
  );

  const correctCount = alignments.filter((alignment) => alignment !== "weak").length;

  return {
    brainPower: STORY_BRAIN_POWER,
    correctCount,
    energyDelta,
    incorrectCount: alignments.length - correctCount,
  };
}

export function computeScore(input: ActivityScoreInput): ScoreResult {
  const correctCount = input.results.filter((result) => result.isCorrect).length;
  const incorrectCount = input.results.length - correctCount;
  const energyDelta = calculateEnergyDelta(input.results);

  return {
    brainPower: BRAIN_POWER_PER_ACTIVITY,
    correctCount,
    energyDelta: Math.round(energyDelta * 100) / 100,
    incorrectCount,
  };
}
