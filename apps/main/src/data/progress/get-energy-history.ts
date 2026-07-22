import "server-only";
import { getSession } from "@/data/users/get-session";
import { type TimePeriod, aggregateByPeriod } from "@zoonk/utils/aggregation";
import { formatLabel } from "@zoonk/utils/chart";
import { type HistoryPeriod, calculateFullPeriodDateRanges } from "@zoonk/utils/date-ranges";
import { computeDecayedEnergy } from "@zoonk/utils/energy";
import { safeAsync } from "@zoonk/utils/error";
import { fillGapsWithDecay } from "./_fill-gaps";
import {
  type DailyProgressHistoryRow,
  hasEarlierDailyProgress,
  listDailyProgressRows,
} from "./daily-progress-queries";
import { getUserProgress } from "./get-user-progress";

export type EnergyPeriod = HistoryPeriod;

export type EnergyDataPoint = { date: Date; energy: number; label: string };

type EnergyHistoryData = {
  dataPoints: EnergyDataPoint[];
  average: number;
  currentEnergy: number;
  previousAverage: number | null;
  periodStart: Date;
  periodEnd: Date;
  hasPreviousPeriod: boolean;
  hasNextPeriod: boolean;
};

function calculateAverage(dataPoints: { energy: number }[]): number {
  if (dataPoints.length === 0) {
    return 0;
  }

  const sum = dataPoints.reduce((acc, point) => acc + point.energy, 0);
  return sum / dataPoints.length;
}

type RawDataPoint = { date: Date; energy: number };

type EnergyHistoryParams = { period: EnergyPeriod; offset?: number; locale?: string };

type EnergyHistoryQueryData = {
  currentData: RawDataPoint[];
  hasEarlierData: boolean;
  previousData: RawDataPoint[];
};

type EnergyProgressState = { currentEnergy: number; lastActiveAt: Date } | null;

/**
 * Captures one approximate timestamp for both Energy decay and its calendar
 * ranges. Caching this domain result keeps the route prerenderable and avoids
 * computing related boundaries from different timestamps.
 */
async function getEnergyHistoryDateRanges({
  offset,
  period,
}: {
  offset: number;
  period: EnergyPeriod;
}) {
  "use cache";

  const now = new Date();
  return { now, ...calculateFullPeriodDateRanges({ now, offset, period }) };
}

function aggregateEnergy(dataPoints: RawDataPoint[], period: TimePeriod): RawDataPoint[] {
  return aggregateByPeriod(dataPoints, (point) => point.energy, "average", period).map((item) => ({
    date: item.date,
    energy: item.value,
  }));
}

function getPreviousAverage(previousData: RawDataPoint[], period: EnergyPeriod): number | null {
  if (previousData.length === 0) {
    return null;
  }

  const processed = processEnergyData(previousData, period);
  return processed.length > 0 ? calculateAverage(processed) : null;
}

/** Extracts the Energy metric from a canonical DailyProgress history row. */
function toRawEnergyDataPoint(row: DailyProgressHistoryRow): RawDataPoint {
  return { date: row.date, energy: row.energyAtEnd };
}

/**
 * Converts shared query results into the small Energy input consumed by chart
 * aggregation, keeping database access separate from metric behavior.
 */
function toEnergyHistoryQueryData({
  currentRows,
  hasEarlierData,
  previousRows,
}: {
  currentRows: DailyProgressHistoryRow[];
  hasEarlierData: boolean;
  previousRows: DailyProgressHistoryRow[];
}): EnergyHistoryQueryData {
  return {
    currentData: currentRows.map((row) => toRawEnergyDataPoint(row)),
    hasEarlierData,
    previousData: previousRows.map((row) => toRawEnergyDataPoint(row)),
  };
}

/**
 * Converts cached query primitives into the localized chart contract. Energy
 * decay is evaluated outside the persistent cache so time can advance without
 * requiring a progress mutation.
 */
function buildEnergyHistory({
  currentEnd,
  currentStart,
  locale,
  now,
  offset,
  period,
  progress,
  queryData,
}: {
  currentEnd: Date;
  currentStart: Date;
  locale: string;
  now: Date;
  offset: number;
  period: EnergyPeriod;
  progress: EnergyProgressState;
  queryData: EnergyHistoryQueryData;
}): EnergyHistoryData | null {
  if (queryData.currentData.length === 0) {
    return null;
  }

  const currentData = processEnergyData(queryData.currentData, period);

  const dataPoints: EnergyDataPoint[] = currentData.map((row) => ({
    date: row.date,
    energy: row.energy,
    label: formatLabel(row.date, period, locale),
  }));

  return {
    average: calculateAverage(currentData),
    currentEnergy: progress
      ? computeDecayedEnergy(progress.currentEnergy, progress.lastActiveAt, now)
      : 0,
    dataPoints,
    hasNextPeriod: offset > 0,
    hasPreviousPeriod: queryData.hasEarlierData,
    periodEnd: currentEnd,
    periodStart: currentStart,
    previousAverage: getPreviousAverage(queryData.previousData, period),
  };
}

/**
 * Composes cached progress reads into the Energy history view.
 */
async function loadEnergyHistory({
  locale = "en",
  offset = 0,
  period,
}: EnergyHistoryParams): Promise<EnergyHistoryData | null> {
  const { current, now, previous } = await getEnergyHistoryDateRanges({ offset, period });

  const [currentRows, previousRows, hasEarlierData, progress] = await Promise.all([
    listDailyProgressRows({ endDate: current.end, startDate: current.start }),
    listDailyProgressRows({ endDate: previous.end, startDate: previous.start }),
    hasEarlierDailyProgress({ answersOnly: false, beforeDate: current.start }),
    getUserProgress(),
  ]);

  const queryData = toEnergyHistoryQueryData({ currentRows, hasEarlierData, previousRows });

  return buildEnergyHistory({
    currentEnd: current.end,
    currentStart: current.start,
    locale,
    now,
    offset,
    period,
    progress: progress
      ? { currentEnergy: progress.currentEnergy, lastActiveAt: progress.lastActiveAt }
      : null,
    queryData,
  });
}

/**
 * Optional history UI degrades transient data failures to null here, outside
 * the regular cache, so a later render can retry instead of reusing a fallback.
 */
export async function getEnergyHistory(
  params: EnergyHistoryParams,
): Promise<EnergyHistoryData | null> {
  const { data } = await safeAsync(async () => {
    const session = await getSession();
    return session ? loadEnergyHistory(params) : null;
  });

  return data;
}

function processEnergyData(rawData: RawDataPoint[], period: EnergyPeriod): RawDataPoint[] {
  const withDecay = fillGapsWithDecay(rawData);

  if (period === "all") {
    return aggregateEnergy(withDecay, "year");
  }

  if (period === "6months") {
    return aggregateEnergy(withDecay, "week");
  }

  if (period === "year") {
    return aggregateEnergy(withDecay, "month");
  }

  return withDecay;
}
