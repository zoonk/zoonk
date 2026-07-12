import { toUTCMidnight } from "@zoonk/utils/energy";

/**
 * Admin rolling metrics use date-only database rows, so their boundaries must
 * be calculated in UTC. The current window includes today and the preceding
 * days; the previous start keeps comparisons on equal calendar-day windows.
 */
export function getRollingUtcDateWindowStarts({ days, now }: { days: number; now: Date }) {
  const currentPeriodStart = addUtcDays({ date: toUTCMidnight(now), days: 1 - days });
  const previousPeriodStart = addUtcDays({ date: currentPeriodStart, days: -days });

  return { currentPeriodStart, previousPeriodStart };
}

/**
 * UTC date construction handles month and year boundaries without relying on
 * local timezone offsets, which would shift date-only progress rows for some
 * deployments.
 */
function addUtcDays({ date, days }: { date: Date; days: number }) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}
