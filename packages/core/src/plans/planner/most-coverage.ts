import { toShownShare } from "../_utils/plan-feasibility-view";
import { MAX_DAILY_MINUTES } from "../daily-minutes";
import { narrowFit } from "./daily-time-plans";
import { PLAN_EPSILON } from "./plan-precision";

export type MostCoverage = { coveredShare: number; minutes: number };

/**
 * For a goal no daily time covers: when a whole day covers no more than half a day does, part of it
 * never fits, so this is the fewest minutes that cover as much as a whole day, with that share.
 */
export function findMostCoverage(
  coverageAt: (dailyMinutes: number) => { coveredShare: number },
): MostCoverage | null {
  const wholeDay = coverageAt(MAX_DAILY_MINUTES).coveredShare;
  const reaches = (minutes: number) => coverageAt(minutes).coveredShare >= wholeDay - PLAN_EPSILON;

  if (!reaches(MAX_DAILY_MINUTES / 2)) {
    return null;
  }

  return {
    coveredShare: toShownShare({ coveredShare: wholeDay, fits: false }),
    minutes: narrowFit({ fits: reaches, fitting: MAX_DAILY_MINUTES, short: 0 }),
  };
}
