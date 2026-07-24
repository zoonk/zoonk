import "server-only";
import { type ScoreRangeParams } from "./_utils/score-date-range";
import { type WeekdayScorePerformance, getScorePatterns } from "./get-score-patterns";

/**
 * Preserves the compact Home query while deriving its result from the same
 * complete weekday dataset used by the Patterns page.
 */
export async function getBestDay(
  params: ScoreRangeParams = {},
): Promise<WeekdayScorePerformance | null> {
  const patterns = await getScorePatterns(params);
  return patterns?.strongestWeekday ?? null;
}
