import { toUTCMidnight } from "@zoonk/utils/date";

/** The rows are date-only, so window boundaries are computed in UTC. */
export function getRollingUtcDateWindowStarts({ days, now }: { days: number; now: Date }) {
  const currentPeriodStart = addUtcDays({ date: toUTCMidnight(now), days: 1 - days });
  const previousPeriodStart = addUtcDays({ date: currentPeriodStart, days: -days });

  return { currentPeriodStart, previousPeriodStart };
}

function addUtcDays({ date, days }: { date: Date; days: number }) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}
