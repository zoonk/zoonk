import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { USAGE_WINDOW_MS } from "../limits";

export function getUsagePeriodStarts(now: Date) {
  return { day: toUTCMidnight(now), rolling30Days: new Date(now.getTime() - USAGE_WINDOW_MS) };
}
export function getUsageResets(now: Date) {
  return { day: new Date(toUTCMidnight(now).getTime() + MS_PER_DAY) };
}
