const BRAIN_POWER_PER_ACTIVITY = 10;
const ENERGY_PER_CORRECT = 0.2;
const ENERGY_PER_INCORRECT = -0.1;

export type ActivityScoreInput = {
  results: { isCorrect: boolean }[];
};

export type ScoreResult = {
  brainPower: number;
  correctCount: number;
  energyDelta: number;
  incorrectCount: number;
};

export function computeScore(input: ActivityScoreInput): ScoreResult {
  const correctCount = input.results.filter((result) => result.isCorrect).length;
  const incorrectCount = input.results.length - correctCount;
  const energyDelta = correctCount * ENERGY_PER_CORRECT + incorrectCount * ENERGY_PER_INCORRECT;

  return {
    brainPower: BRAIN_POWER_PER_ACTIVITY,
    correctCount,
    energyDelta: Math.round(energyDelta * 100) / 100,
    incorrectCount,
  };
}
