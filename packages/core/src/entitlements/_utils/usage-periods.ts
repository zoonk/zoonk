import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";

/** Use UTC so changing a learner's time zone cannot reset their usage budget. */
export function getUsagePeriodStarts(now: Date) {
  return {
    day: toUTCMidnight(now),
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  };
}

export function getUsageResets(now: Date) {
  const starts = getUsagePeriodStarts(now);

  return {
    day: new Date(starts.day.getTime() + MS_PER_DAY),
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}
