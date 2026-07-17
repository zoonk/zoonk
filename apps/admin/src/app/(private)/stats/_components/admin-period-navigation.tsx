import { Button } from "@zoonk/ui/components/button";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

type StatsPeriodPath = "/stats/content" | "/stats/engagement" | "/stats/growth";
type StatsPeriodHref = `${StatsPeriodPath}?${string}`;
type StatsPeriodQueryParams = Record<string, string | string[] | undefined>;
type StatsPeriodQueryEntry = [string, string] | undefined;

/**
 * Period navigation has two predictable destinations, so Next links can fetch
 * their cached analytics payloads before the admin clicks either direction.
 */
export function AdminPeriodNavigation({
  basePath,
  offset,
  period,
  periodLabel,
  queryParams,
}: {
  basePath: StatsPeriodPath;
  offset: number;
  period: HistoryPeriod;
  periodLabel: string;
  queryParams?: StatsPeriodQueryParams;
}) {
  const previousHref = buildStatsPeriodHref({ basePath, offset: offset + 1, period, queryParams });

  const nextHref =
    offset > 0
      ? buildStatsPeriodHref({ basePath, offset: offset - 1, period, queryParams })
      : undefined;

  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label="Previous period"
        nativeButton={false}
        render={<Link href={previousHref} prefetch />}
        size="icon"
        variant="outline"
      >
        <ChevronLeftIcon aria-hidden />
      </Button>

      <span className="min-w-32 text-center text-sm font-medium">{periodLabel}</span>

      {nextHref ? (
        <Button
          aria-label="Next period"
          nativeButton={false}
          render={<Link href={nextHref} prefetch />}
          size="icon"
          variant="outline"
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      ) : (
        <Button aria-label="Next period" disabled size="icon" variant="outline">
          <ChevronRightIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}

/**
 * Existing analytics filters must survive a period change, while period and
 * offset are replaced with the destination selected by the pager.
 */
function buildStatsPeriodHref({
  basePath,
  offset,
  period,
  queryParams,
}: {
  basePath: StatsPeriodPath;
  offset: number;
  period: HistoryPeriod;
  queryParams?: StatsPeriodQueryParams;
}): StatsPeriodHref {
  const preservedEntries = Object.entries(queryParams ?? {})
    .map((entry) => getStatsPeriodQueryEntry(entry))
    .filter((entry) => isStatsPeriodQueryEntry(entry))
    .filter(([key]) => key !== "offset" && key !== "period");

  const entries = [
    ...preservedEntries,
    ["period", period],
    ["offset", offset.toString()],
  ] satisfies [string, string][];

  return `${basePath}?${new URLSearchParams(entries).toString()}`;
}

/**
 * Repeated query values are not used by analytics filters, so preserving the
 * first value keeps navigation deterministic without discarding the filter.
 */
function getStatsPeriodQueryEntry([key, value]: [
  string,
  string | string[] | undefined,
]): StatsPeriodQueryEntry {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue ? [key, firstValue] : undefined;
}

/**
 * URLSearchParams accepts only complete string pairs after optional filters
 * have been normalized.
 */
function isStatsPeriodQueryEntry(entry: StatsPeriodQueryEntry): entry is [string, string] {
  return Array.isArray(entry);
}
