import {
  type HistoryPeriod,
  calculateDateRanges,
  formatPeriodLabel,
} from "@zoonk/utils/date-ranges";
import { validateOffset } from "@zoonk/utils/number";

const CUSTOM_PERIOD_MAX_DAILY_DAYS = 62;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const END_OF_DAY_HOURS = 23;
const END_OF_DAY_MINUTES = 59;
const END_OF_DAY_SECONDS = 59;
const END_OF_DAY_MS = 999;

export type AdminStatsPeriod = "all" | "custom" | "month" | "year";

type StatsSearchParams = {
  end?: string | string[];
  offset?: string | string[];
  period?: string | string[];
  start?: string | string[];
};

/**
 * Analytics only supports periods that correspond to a real decision: a
 * calendar month, calendar year, all time, or a deliberately chosen range.
 */
function parseAdminStatsPeriod(value: string): AdminStatsPeriod {
  if (value === "month" || value === "year" || value === "all" || value === "custom") {
    return value;
  }

  return "year";
}

/**
 * Custom dates use a strict UTC calendar representation so links behave the
 * same way for admins in every timezone and malformed dates never reach a
 * database boundary.
 */
function parseCustomDate(value: string | string[] | undefined): Date | undefined {
  const scalarValue = Array.isArray(value) ? value[0] : value;

  if (!scalarValue || !/^\d{4}-\d{2}-\d{2}$/u.test(scalarValue)) {
    return undefined;
  }

  const date = new Date(`${scalarValue}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== scalarValue) {
    return undefined;
  }

  return date;
}

/**
 * Includes the full final calendar day because all period queries use
 * inclusive boundaries.
 */
function getEndOfDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      END_OF_DAY_HOURS,
      END_OF_DAY_MINUTES,
      END_OF_DAY_SECONDS,
      END_OF_DAY_MS,
    ),
  );
}

/**
 * Current-period charts stop at today rather than plotting future calendar
 * buckets as false zeroes. Historical and earlier custom ranges keep their
 * complete selected boundary.
 */
function getChartEnd(end: Date): Date {
  const today = getEndOfDay(new Date());
  return end < today ? end : today;
}

/**
 * Compares a custom range with the immediately preceding range of the same
 * duration, which makes the change indicator meaningful without inventing a
 * month or year boundary the admin did not select.
 */
function getCustomDateRanges({ end, start }: { end: Date; start: Date }) {
  const currentEnd = getEndOfDay(end);
  const duration = currentEnd.getTime() - start.getTime() + 1;
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration + 1);

  return {
    current: { end: currentEnd, start },
    previous: { end: previousEnd, start: previousStart },
  };
}

/**
 * Daily buckets remain readable for short custom ranges; longer ranges switch
 * to monthly buckets so the chart does not become a wall of tiny points.
 */
function getCustomChartPeriod({ end, start }: { end: Date; start: Date }): HistoryPeriod {
  const durationDays = Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY) + 1;
  return durationDays <= CUSTOM_PERIOD_MAX_DAILY_DAYS ? "month" : "year";
}

/**
 * A custom range is used only when both dates are valid, ordered, and not in
 * the future. Invalid or partial shared links safely return to the current
 * calendar year instead of comparing partial data with a complete prior range.
 */
function getValidCustomRange({
  end,
  start,
}: {
  end: string | string[] | undefined;
  start: string | string[] | undefined;
}) {
  const parsedEnd = parseCustomDate(end);
  const parsedStart = parseCustomDate(start);
  const today = getEndOfDay(new Date());

  if (!parsedEnd || !parsedStart || parsedStart > parsedEnd || parsedEnd > today) {
    return;
  }

  return { end: parsedEnd, start: parsedStart };
}

/**
 * Calendar ranges only change at period boundaries. Private caching lets
 * runtime prefetching resolve URL-backed controls while reading search params
 * inside the same function.
 */
export async function getStatsPeriod(params: StatsSearchParams) {
  "use cache: private";

  const requestedPeriod = parseAdminStatsPeriod(String(params.period ?? "year"));
  const customRange = getValidCustomRange({ end: params.end, start: params.start });

  if (requestedPeriod === "custom" && customRange) {
    const ranges = getCustomDateRanges(customRange);

    return {
      ...ranges,
      chartEnd: getChartEnd(ranges.current.end),
      chartPeriod: getCustomChartPeriod(customRange),
      comparisonLabel: "vs previous period",
      offset: 0,
      period: requestedPeriod,
      periodLabel: `${formatCustomDate(customRange.start)} – ${formatCustomDate(customRange.end)}`,
    };
  }

  const period = requestedPeriod === "custom" ? "year" : requestedPeriod;
  const offset = validateOffset(params.offset);
  const { current, previous } = calculateDateRanges(period, offset);

  return {
    chartEnd: getChartEnd(current.end),
    chartPeriod: period,
    comparisonLabel: getComparisonLabel(period),
    current,
    offset,
    period,
    periodLabel: formatPeriodLabel(current.start, current.end, period, "en"),
    previous,
  };
}

/**
 * Custom range labels stay compact enough for the mobile header while showing
 * the selected boundaries without ambiguity.
 */
function formatCustomDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

/**
 * Period comparisons use plain language that reflects the actual paired range
 * returned by the shared calendar utility.
 */
function getComparisonLabel(period: HistoryPeriod): string {
  if (period === "month") {
    return "vs last month";
  }

  if (period === "year") {
    return "vs last year";
  }

  return "";
}

/**
 * Switching analyses preserves only the normalized period state, preventing
 * unrelated filters from leaking between Growth, Engagement, and Content.
 */
export function buildStatsPeriodQuery(statsPeriod: StatsPeriod): string {
  const entries: [string, string][] = [
    ["period", statsPeriod.period],
    ...getOffsetQueryEntries(statsPeriod),
    ...getCustomQueryEntries(statsPeriod),
  ];

  return new URLSearchParams(entries).toString();
}

/**
 * Zero is the canonical current-period offset, so omitting it keeps shared
 * URLs short without changing their meaning.
 */
function getOffsetQueryEntries(statsPeriod: StatsPeriod): [string, string][] {
  return statsPeriod.offset > 0 ? [["offset", statsPeriod.offset.toString()]] : [];
}

/**
 * Custom boundaries belong in the URL only when the custom preset is active;
 * calendar and all-time links derive their ranges without duplicated dates.
 */
function getCustomQueryEntries(statsPeriod: StatsPeriod): [string, string][] {
  if (statsPeriod.period !== "custom") {
    return [];
  }

  return [
    ["start", statsPeriod.current.start.toISOString().slice(0, 10)],
    ["end", statsPeriod.current.end.toISOString().slice(0, 10)],
  ];
}

export type StatsPeriod = Awaited<ReturnType<typeof getStatsPeriod>>;
