export const BRAIN_POWER_PER_ACTIVITY = 10;
export const BRAIN_POWER_PER_CHALLENGE = 100;

const ENERGY_PER_CORRECT = 0.2;
const ENERGY_PER_INCORRECT = -0.1;
const ENERGY_PER_STATIC = 0.1;
const CHALLENGE_FAILURE_ENERGY = 0.1;

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

export function computeChallengeScore(input: ChallengeScoreInput): ScoreResult {
  if (input.isSuccessful) {
    const positiveSum = Object.values(input.dimensions)
      .filter((value) => value > 0)
      .reduce((sum, value) => sum + value, 0);

    return {
      brainPower: BRAIN_POWER_PER_CHALLENGE,
      correctCount: 0,
      energyDelta: Math.max(1, positiveSum),
      incorrectCount: 0,
    };
  }

  return {
    brainPower: BRAIN_POWER_PER_ACTIVITY,
    correctCount: 0,
    energyDelta: CHALLENGE_FAILURE_ENERGY,
    incorrectCount: 0,
  };
}
