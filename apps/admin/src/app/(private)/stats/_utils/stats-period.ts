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

function parseAdminStatsPeriod(value: string): AdminStatsPeriod {
  if (value === "month" || value === "year" || value === "all" || value === "custom") {
    return value;
  }

  return "year";
}

/** Strict UTC dates, so links read the same for admins in every time zone. */
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

/** Current-period charts stop at today instead of plotting future buckets as zeroes. */
function getChartEnd(end: Date): Date {
  const today = getEndOfDay(new Date());
  return end < today ? end : today;
}

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

function getCustomChartPeriod({ end, start }: { end: Date; start: Date }): HistoryPeriod {
  const durationDays = Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY) + 1;
  return durationDays <= CUSTOM_PERIOD_MAX_DAILY_DAYS ? "month" : "year";
}

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

function formatCustomDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function getComparisonLabel(period: HistoryPeriod): string {
  if (period === "month") {
    return "vs last month";
  }

  if (period === "year") {
    return "vs last year";
  }

  return "";
}

export function buildStatsPeriodQuery(statsPeriod: StatsPeriod): string {
  const entries: [string, string][] = [
    ["period", statsPeriod.period],
    ...getOffsetQueryEntries(statsPeriod),
    ...getCustomQueryEntries(statsPeriod),
  ];

  return new URLSearchParams(entries).toString();
}

function getOffsetQueryEntries(statsPeriod: StatsPeriod): [string, string][] {
  return statsPeriod.offset > 0 ? [["offset", statsPeriod.offset.toString()]] : [];
}

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
