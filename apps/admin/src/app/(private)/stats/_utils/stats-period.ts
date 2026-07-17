import { calculateDateRanges, formatPeriodLabel, validatePeriod } from "@zoonk/utils/date-ranges";
import { validateOffset } from "@zoonk/utils/number";

type StatsSearchParams = Promise<{ offset?: string | string[]; period?: string | string[] }>;

/**
 * Calendar ranges only change at period boundaries. Private caching lets
 * runtime prefetching resolve URL-backed controls while reading search params
 * inside the same function.
 */
export async function getStatsPeriod(searchParams: StatsSearchParams) {
  "use cache: private";

  const { offset: rawOffset, period: rawPeriod } = await searchParams;

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

export type StatsPeriod = Awaited<ReturnType<typeof getStatsPeriod>>;
