import { type ScoreStep } from "./types";

const STEP_WEIGHTS = { majorErrors: 3, minorErrors: 2, potentialImprovements: 1 } as const;

/**
 * Calculates the shared weighted score without loading the judge runtime, so
 * client displays and export selection use exactly the same ranking rule.
 */
export function calculateScore(steps: ScoreStep[]): number {
  const weightedTotal = steps.reduce(
    (total, step) => total + step.score * STEP_WEIGHTS[step.kind],
    0,
  );

  const totalWeight = steps.reduce((total, step) => total + STEP_WEIGHTS[step.kind], 0);

  return weightedTotal / totalWeight;
}
