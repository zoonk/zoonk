import { CEFR_LEVELS, MAX_CEFR_SCORE, parseCefrScore } from "@zoonk/utils/cefr";

const BAND_COUNT = CEFR_LEVELS.length;

/** A plain level ("A2") sits in the middle of its band and a plus ("A2+") at its end. */
const HALF_BAND = 0.5;

/**
 * Where a level sits on the A1 to C2 bar, from 0 to 1. Levels are half steps from A1 (0) to
 * C2 (5), so "B1" fills half of the B1 band and "B1+" fills it. C2 has nothing above it, so it
 * fills the bar.
 */
export function getLevelShare(score: number): number {
  if (score >= MAX_CEFR_SCORE) {
    return 1;
  }

  return Math.max(0, (score + HALF_BAND) / BAND_COUNT);
}

/** How much of one band a level fills, for drawing the bar band by band. */
export function getBandFill({ band, score }: { band: number; score: number }): number {
  return Math.min(1, Math.max(0, getLevelShare(score) * BAND_COUNT - band));
}

/**
 * The skills that went up since the level test (the ones with an up arrow), the biggest rise
 * first, for "Listening went up to B1" or "Listening and Speaking went up". On a tie, list order
 * wins. Empty when nothing went up.
 */
export function listRises<TLevel extends { score: number; startLabel: string; trend: string }>(
  levels: readonly TLevel[],
): TLevel[] {
  const rise = (level: TLevel) => level.score - (parseCefrScore(level.startLabel) ?? level.score);

  return levels.filter((level) => level.trend === "up").toSorted((a, b) => rise(b) - rise(a));
}
