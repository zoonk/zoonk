import "server-only";
import { type ScoreRangeParams } from "./_utils/score-date-range";
import { type TimeScorePerformance, getScorePatterns } from "./get-score-patterns";

/**
 * Preserves the compact Home query while deriving its result from the same
 * complete time-of-day dataset used by the Patterns page.
 */
export async function getBestTime(
  params: ScoreRangeParams = {},
): Promise<TimeScorePerformance | null> {
  const patterns = await getScorePatterns(params);
  return patterns?.strongestTime ?? null;
}
