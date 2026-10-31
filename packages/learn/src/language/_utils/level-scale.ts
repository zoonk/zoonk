import { CEFR_LEVELS, MAX_CEFR_SCORE, parseCefrScore } from "@zoonk/utils/cefr";

const BAND_COUNT = CEFR_LEVELS.length;

const HALF_BAND = 0.5;

/**
 * Scores are half steps from A1 (0) to C2 (5): "B1" fills half of the B1 band, "B1+" all of it, and
 * C2 the bar.
 */
export function getLevelShare(score: number): number {
  if (score >= MAX_CEFR_SCORE) {
    return 1;
  }

  return Math.max(0, (score + HALF_BAND) / BAND_COUNT);
}

export function getBandFill({ band, score }: { band: number; score: number }): number {
  return Math.min(1, Math.max(0, getLevelShare(score) * BAND_COUNT - band));
}

/** "Even" needs two skills measured: one skill alone leads nothing. A tie at the top names no skill. */
export function getLeadingSkill<TLevel extends { score: number; skill: string }>(
  levels: readonly TLevel[],
): { kind: "even" } | { kind: "leads"; skill: TLevel["skill"] } | null {
  const [first, ...rest] = levels.toSorted((a, b) => b.score - a.score);

  if (!first || rest.length === 0) {
    return null;
  }

  if (rest.every((level) => level.score === first.score)) {
    return { kind: "even" };
  }

  return rest[0]?.score === first.score ? null : { kind: "leads", skill: first.skill };
}

export function listRises<TLevel extends { score: number; startLabel: string; trend: string }>(
  levels: readonly TLevel[],
): TLevel[] {
  const rise = (level: TLevel) => level.score - (parseCefrScore(level.startLabel) ?? level.score);

  return levels.filter((level) => level.trend === "up").toSorted((a, b) => rise(b) - rise(a));
}
