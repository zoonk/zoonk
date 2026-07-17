import { calculateDateRanges, formatPeriodLabel, validatePeriod } from "@zoonk/utils/date-ranges";
import { validateOffset } from "@zoonk/utils/number";
import { cache } from "react";

type StatsSearchParams = Promise<{ offset?: string | string[]; period?: string | string[] }>;

/**
 * Calendar ranges are shared across admins and only change at period
 * boundaries. Caching this synchronous clock read lets runtime prefetching
 * resolve URL-backed controls without tying them to a live connection.
 */
async function getCachedStatsPeriod({
  rawOffset,
  rawPeriod,
}: {
  rawOffset?: string | string[];
  rawPeriod?: string | string[];
}) {
  "use cache";

  const period = validatePeriod(String(rawPeriod ?? "month"));
  const offset = validateOffset(rawOffset);
  const { current, previous } = calculateDateRanges(period, offset);

  return {
    current,
    offset,
    period,
    periodLabel: formatPeriodLabel(current.start, current.end, period, "en"),
    previous,
  };
}

/**
 * A route can request its period context from multiple local Suspense
 * boundaries. React request memoization keeps those reads coordinated while
 * the inner Cache Component supplies the reusable time-based value.
 */
export const getStatsPeriod = cache(async (searchParams: StatsSearchParams) => {
  const { offset, period } = await searchParams;
  return getCachedStatsPeriod({ rawOffset: offset, rawPeriod: period });
});

export type StatsPeriod = Awaited<ReturnType<typeof getStatsPeriod>>;
