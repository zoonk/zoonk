import {
  BRAIN_POWER_PER_ACTIVITY,
  TRADEOFF_BRAIN_POWER,
  TRADEOFF_ENERGY,
} from "@zoonk/utils/brain-power";
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

/**
 * Tradeoff activities have no correct/incorrect answers — they test
 * judgment, not recall. They award a boosted reward (100 BP + 5 energy)
 * to reflect the higher engagement and complexity.
 */
export function computeTradeoffScore(): ScoreResult {
  return {
    brainPower: TRADEOFF_BRAIN_POWER,
    correctCount: 0,
    energyDelta: TRADEOFF_ENERGY,
    incorrectCount: 0,
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
