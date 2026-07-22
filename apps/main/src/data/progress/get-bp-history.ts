import "server-only";
import { getSession } from "@/data/users/get-session";
import { aggregateByPeriod } from "@zoonk/utils/aggregation";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { formatLabel } from "@zoonk/utils/chart";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { safeAsync } from "@zoonk/utils/error";
import { getDateRanges } from "./_utils/history-date-ranges";
import {
  type DailyProgressHistoryRow,
  hasEarlierDailyProgress,
  listDailyProgressRows,
} from "./daily-progress-queries";
import { getUserProgress } from "./get-user-progress";

export type BpDataPoint = { date: Date; bp: number; label: string };

type BpHistoryData = {
  dataPoints: BpDataPoint[];
  totalBp: number;
  periodTotal: number;
  previousPeriodTotal: number | null;
  periodStart: Date;
  periodEnd: Date;
  hasPreviousPeriod: boolean;
  hasNextPeriod: boolean;
  currentBelt: BeltLevelResult;
};

type RawDataPoint = { date: Date; bp: number };

type BpHistoryParams = { period: HistoryPeriod; offset?: number; locale?: string };

type BpHistoryQueryData = {
  currentData: RawDataPoint[];
  hasEarlierData: boolean;
  previousData: RawDataPoint[];
};

/**
 * Extracts the Brain Power metric from a canonical DailyProgress history row.
 */
function toRawBpDataPoint(row: DailyProgressHistoryRow): RawDataPoint {
  return { bp: row.brainPowerEarned, date: row.date };
}

/**
 * Converts shared query results into the small Brain Power input consumed by
 * chart aggregation, keeping database access separate from metric behavior.
 */
function toBpHistoryQueryData({
  currentRows,
  hasEarlierData,
  previousRows,
}: {
  currentRows: DailyProgressHistoryRow[];
  hasEarlierData: boolean;
  previousRows: DailyProgressHistoryRow[];
}): BpHistoryQueryData {
  return {
    currentData: currentRows.map((row) => toRawBpDataPoint(row)),
    hasEarlierData,
    previousData: previousRows.map((row) => toRawBpDataPoint(row)),
  };
}

function processBpData(rawData: RawDataPoint[], period: HistoryPeriod): RawDataPoint[] {
  if (period === "all") {
    return aggregateByPeriod(rawData, (point) => point.bp, "sum", "year").map((item) => ({
      bp: item.value,
      date: item.date,
    }));
  }

  if (period === "6months") {
    return aggregateByPeriod(rawData, (point) => point.bp, "sum", "week").map((item) => ({
      bp: item.value,
      date: item.date,
    }));
  }

  if (period === "year") {
    return aggregateByPeriod(rawData, (point) => point.bp, "sum", "month").map((item) => ({
      bp: item.value,
      date: item.date,
    }));
  }

  return rawData;
}

function sumBp(dataPoints: RawDataPoint[]): number {
  return dataPoints.reduce((acc, point) => acc + point.bp, 0);
}

function getPreviousPeriodTotal(previousData: RawDataPoint[]): number | null {
  if (previousData.length === 0) {
    return null;
  }

  return sumBp(previousData);
}

/**
 * Converts cached query primitives into the localized chart contract. Keeping
 * this transformation pure avoids separate cache entries for each locale.
 */
function buildBpHistory({
  currentEnd,
  currentStart,
  locale,
  offset,
  period,
  queryData,
  totalBp,
}: {
  currentEnd: Date;
  currentStart: Date;
  locale: string;
  offset: number;
  period: HistoryPeriod;
  queryData: BpHistoryQueryData;
  totalBp: number;
}): BpHistoryData | null {
  if (queryData.currentData.length === 0) {
    return null;
  }

  const processedData = processBpData(queryData.currentData, period);

  const dataPoints: BpDataPoint[] = processedData.map((row) => ({
    bp: row.bp,
    date: row.date,
    label: formatLabel(row.date, period, locale),
  }));

  return {
    currentBelt: calculateBeltLevel(totalBp),
    dataPoints,
    hasNextPeriod: offset > 0,
    hasPreviousPeriod: queryData.hasEarlierData,
    periodEnd: currentEnd,
    periodStart: currentStart,
    periodTotal: sumBp(queryData.currentData),
    previousPeriodTotal: getPreviousPeriodTotal(queryData.previousData),
    totalBp,
  };
}

/**
 * Composes cached progress reads into the Brain Power history view.
 */
async function loadBpHistory({
  locale = "en",
  offset = 0,
  period,
}: BpHistoryParams): Promise<BpHistoryData | null> {
  const { current, previous } = await getDateRanges({ offset, period });

  const [currentRows, previousRows, hasEarlierData, progress] = await Promise.all([
    listDailyProgressRows({ endDate: current.end, startDate: current.start }),
    listDailyProgressRows({ endDate: previous.end, startDate: previous.start }),
    hasEarlierDailyProgress({ answersOnly: false, beforeDate: current.start }),
    getUserProgress(),
  ]);

  const queryData = toBpHistoryQueryData({ currentRows, hasEarlierData, previousRows });

  return buildBpHistory({
    currentEnd: current.end,
    currentStart: current.start,
    locale,
    offset,
    period,
    queryData,
    totalBp: Number(progress?.totalBrainPower ?? 0),
  });
}

/**
 * Optional history UI degrades transient data failures to null here, outside
 * the regular cache, so a later render can retry instead of reusing a fallback.
 */
export async function getBpHistory(params: BpHistoryParams): Promise<BpHistoryData | null> {
  const { data } = await safeAsync(async () => {
    const session = await getSession();
    return session ? loadBpHistory(params) : null;
  });

  return data;
}
