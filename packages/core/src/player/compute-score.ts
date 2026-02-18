import {
  BRAIN_POWER_PER_ACTIVITY,
  BRAIN_POWER_PER_CHALLENGE,
  CHALLENGE_FAILURE_ENERGY,
  ENERGY_PER_CORRECT,
  ENERGY_PER_INCORRECT,
  ENERGY_PER_STATIC,
} from "@zoonk/utils/constants";

export type ActivityScoreInput = {
  results: { isCorrect: boolean }[];
};

export type ChallengeScoreInput = {
  dimensions: Record<string, number>;
  isSuccessful: boolean;
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

function countDimensionOutcomes(dimensions: Record<string, number>) {
  const values = Object.values(dimensions);
  const incorrectCount = values.filter((value) => value < 0).length;
  return { correctCount: values.length - incorrectCount, incorrectCount };
}

export function computeChallengeScore(input: ChallengeScoreInput): ScoreResult {
  const { correctCount, incorrectCount } = countDimensionOutcomes(input.dimensions);

  if (input.isSuccessful) {
    const positiveSum = Object.values(input.dimensions)
      .filter((value) => value > 0)
      .reduce((sum, value) => sum + value, 0);

    return {
      brainPower: BRAIN_POWER_PER_CHALLENGE,
      correctCount,
      energyDelta: Math.max(1, positiveSum),
      incorrectCount,
    };
  }

  return {
    brainPower: BRAIN_POWER_PER_ACTIVITY,
    correctCount,
    energyDelta: CHALLENGE_FAILURE_ENERGY,
    incorrectCount,
  };
}
