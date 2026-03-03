import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";

export const IMPACT_DELTA: Record<ChallengeEffect["impact"], number> = {
  negative: -1,
  neutral: 0,
  positive: 1,
};

export function computeDimensions(stepEffects: ChallengeEffect[][]): Record<string, number> {
  const dimensions: Record<string, number> = {};

  for (const effect of stepEffects.flat()) {
    dimensions[effect.dimension] =
      (dimensions[effect.dimension] ?? 0) + IMPACT_DELTA[effect.impact];
  }

  return dimensions;
}

export function hasNegativeDimension(dimensions: Record<string, number>): boolean {
  return Object.values(dimensions).some((value) => value < 0);
}
