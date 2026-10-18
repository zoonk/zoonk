/** Goethe's scales name no band for the level; its modules pass from 60% of their points. */
const PASS_SHARE = 0.6;

/**
 * The band from which an estimate reaches the exam's level: the band the scale writes for the
 * level (DELE's 2 of 3, Cambridge's 3 of 5), or 60% of the scale where the exam names none and
 * passes from 60% (Goethe's, between C and B).
 */
export function getLevelMark(criterion: { levelBand: number | null; maxBand: number }): number {
  return criterion.levelBand ?? criterion.maxBand * PASS_SHARE;
}

/**
 * Where an estimated range stands against the exam's level: at it (its middle reaches the level's
 * band), near it (only its top does), or below it.
 */
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
