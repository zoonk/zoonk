import "server-only";
import { getRequestTimeZone } from "@/data/_utils/get-request-time-zone";
import {
  type ScoreDateRange,
  type ScoreRangeParams,
  getScoreDateRange,
} from "@zoonk/core/progress/score-date-range";

/**
 * Captures one approximate request instant inside a shared cache while keeping
 * the learner's request-specific timezone as a serializable cache argument.
 */
async function getCurrentScoreDateRange(timeZone: string): Promise<ScoreDateRange> {
  "use cache";

  return getScoreDateRange({ now: new Date(), timeZone });
}

/**
 * Keeps direct request APIs outside shared Score query caches. Tests and
 * historical callers can pass explicit boundaries, while live requests resolve
 * the private request timezone before entering any cached database leaf.
 */
export async function resolveScoreDateRange(
  params: ScoreRangeParams = {},
): Promise<ScoreDateRange> {
  if (params.startDate) {
    return getScoreDateRange(params);
  }

  const timeZone = params.timeZone ?? (await getRequestTimeZone());

  if (params.endDate || params.now) {
    return getScoreDateRange({ ...params, timeZone });
  }

  return getCurrentScoreDateRange(timeZone);
}
