import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";

/**
 * UTC calendar days and months, so every region counts the same bucket and a learner can't gain
 * usage by changing their timezone.
 */
export function getUsagePeriodStarts(now: Date) {
  return {
    day: toUTCMidnight(now),
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  };
}

/** When the daily and monthly counts start over. */
export function getUsageResets(now: Date) {
  const starts = getUsagePeriodStarts(now);

  return {
    day: new Date(starts.day.getTime() + MS_PER_DAY),
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}
