/** Goethe's scales name no band for the level; its modules pass from 60% of their points. */
const PASS_SHARE = 0.6;

export function getLevelMark(criterion: { levelBand: number | null; maxBand: number }): number {
  return criterion.levelBand ?? criterion.maxBand * PASS_SHARE;
}

export function getLevelStanding({
  bandHigh,
  bandLow,
  levelMark,
}: {
  bandHigh: number;
  bandLow: number;
  levelMark: number;
}): "at" | "near" | "below" {
  if ((bandLow + bandHigh) / 2 >= levelMark) {
    return "at";
  }

  return bandHigh >= levelMark ? "near" : "below";
}
