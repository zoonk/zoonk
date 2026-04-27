import { BRAIN_POWER_PER_ACTIVITY } from "@zoonk/utils/brain-power";
import { ENERGY_PER_CORRECT, ENERGY_PER_INCORRECT, ENERGY_PER_STATIC } from "@zoonk/utils/energy";

export type ScoreResult = {
  brainPower: number;
  correctCount: number;
  energyDelta: number;
  incorrectCount: number;
};

type ScoredStepResult = { isCorrect: boolean };

/**
 * Computes completion rewards from checked step results.
 *
 * Client-side completion previews and server-side saved progress both call
 * this function so brain power, energy, and answer counts stay consistent.
 * Activities without checked answers still award a small energy gain because
 * static reading steps count as completing useful lesson work.
 */
export function computeActivityScore({ results }: { results: ScoredStepResult[] }): ScoreResult {
  const correctCount = results.filter((result) => result.isCorrect).length;
  const incorrectCount = results.length - correctCount;

  const energyDelta =
    results.length === 0
      ? ENERGY_PER_STATIC
      : correctCount * ENERGY_PER_CORRECT + incorrectCount * ENERGY_PER_INCORRECT;

  return {
    brainPower: BRAIN_POWER_PER_ACTIVITY,
    correctCount,
    energyDelta: Math.round(energyDelta * 100) / 100,
    incorrectCount,
  };
}
