import "server-only";
import { getSession } from "@/data/users/get-session";
import { aggregateScoreByPeriod } from "@zoonk/utils/aggregation";
import { formatLabel } from "@zoonk/utils/chart";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { safeAsync } from "@zoonk/utils/error";
import { getFullPeriodDateRanges } from "./_utils/history-date-ranges";
import {
  type DailyProgressHistoryRow,
  hasEarlierDailyProgress,
  listDailyProgressRows,
} from "./daily-progress-queries";

export type ScorePeriod = HistoryPeriod;

export type ScoreDataPoint = { date: Date; score: number; label: string };

type ScoreHistoryData = {
  dataPoints: ScoreDataPoint[];
  average: number;
  previousAverage: number | null;
  periodStart: Date;
  periodEnd: Date;
  hasPreviousPeriod: boolean;
  hasNextPeriod: boolean;
};

type RawDataPoint = { date: Date; correct: number; incorrect: number };

type ScoreHistoryParams = { period: ScorePeriod; offset?: number; locale?: string };

type ScoreHistoryQueryData = {
  currentData: RawDataPoint[];
  hasEarlierData: boolean;
  previousData: RawDataPoint[];
};

function calculateScore(correct: number, incorrect: number): number {
  const total = correct + incorrect;

  if (total === 0) {
    return 0;
  }

  return (correct / total) * 100;
}

function calculateAverage(dataPoints: { score: number }[]): number {
  if (dataPoints.length === 0) {
    return 0;
  }

  const sum = dataPoints.reduce((acc, point) => acc + point.score, 0);
  return sum / dataPoints.length;
}

/**
 * Converts a canonical DailyProgress history row into the values needed by score
 * aggregation. This named transformation keeps query orchestration linear.
 */
function toRawScoreDataPoint(row: DailyProgressHistoryRow): RawDataPoint {
  return { correct: row.correctAnswers, date: row.date, incorrect: row.incorrectAnswers };
}

/**
 * Converts shared query results into the small Score input consumed by chart
 * aggregation, keeping database access separate from metric behavior.
 */
function toScoreHistoryQueryData({
  currentRows,
  hasEarlierData,
  previousRows,
}: {
  currentRows: DailyProgressHistoryRow[];
  hasEarlierData: boolean;
  previousRows: DailyProgressHistoryRow[];
}): ScoreHistoryQueryData {
  return {
    currentData: currentRows.map((row) => toRawScoreDataPoint(row)),
    hasEarlierData,
    previousData: previousRows.map((row) => toRawScoreDataPoint(row)),
  };
}

function processScoreData(
  rawData: RawDataPoint[],
  period: ScorePeriod,
): { date: Date; score: number }[] {
  if (period === "month") {
    return rawData.map((point) => ({
      date: point.date,
      score: calculateScore(point.correct, point.incorrect),
    }));
  }

  if (period === "6months") {
    return aggregateScoreByPeriod(rawData, calculateScore, "week");
  }

  if (period === "all") {
    return aggregateScoreByPeriod(rawData, calculateScore, "year");
  }

  return aggregateScoreByPeriod(rawData, calculateScore, "month");
}

function filterValidData(data: RawDataPoint[]): RawDataPoint[] {
  return data.filter((point) => point.correct + point.incorrect > 0);
}

function getPreviousAverage(previousData: RawDataPoint[], period: ScorePeriod): number | null {
  const valid = filterValidData(previousData);

  if (valid.length === 0) {
    return null;
  }

  const processed = processScoreData(valid, period);
  return processed.length > 0 ? calculateAverage(processed) : null;
}

/**
 * Converts cached query primitives into the localized chart contract. Keeping
 * this transformation pure avoids separate cache entries for each locale.
 */
function buildScoreHistory({
  currentEnd,
  currentStart,
  locale,
  offset,
  period,
  queryData,
}: {
  currentEnd: Date;
  currentStart: Date;
  locale: string;
  offset: number;
  period: ScorePeriod;
  queryData: ScoreHistoryQueryData;
}): ScoreHistoryData | null {
  const validData = filterValidData(queryData.currentData);

  if (validData.length === 0) {
    return null;
  }

  const currentData = processScoreData(validData, period);

  const dataPoints: ScoreDataPoint[] = currentData.map((row) => ({
    date: row.date,
    label: formatLabel(row.date, period, locale),
    score: row.score,
  }));

  return {
    average: calculateAverage(currentData),
    dataPoints,
    hasNextPeriod: offset > 0,
    hasPreviousPeriod: queryData.hasEarlierData,
    periodEnd: currentEnd,
    periodStart: currentStart,
    previousAverage: getPreviousAverage(queryData.previousData, period),
  };
}

/**
 * Composes cached progress reads into the Score history view.
 */
async function loadScoreHistory({
  locale = "en",
  offset = 0,
  period,
}: ScoreHistoryParams): Promise<ScoreHistoryData | null> {
  const { current, previous } = await getFullPeriodDateRanges({ offset, period });

  const [currentRows, previousRows, hasEarlierData] = await Promise.all([
    listDailyProgressRows({ endDate: current.end, startDate: current.start }),
    listDailyProgressRows({ endDate: previous.end, startDate: previous.start }),
    hasEarlierDailyProgress({ answersOnly: true, beforeDate: current.start }),
  ]);

  const queryData = toScoreHistoryQueryData({ currentRows, hasEarlierData, previousRows });

  return buildScoreHistory({
    currentEnd: current.end,
    currentStart: current.start,
    locale,
    offset,
    period,
    queryData,
  });
}

/**
 * Optional history UI degrades transient data failures to null here, outside
 * the regular cache, so a later render can retry instead of reusing a fallback.
 */
export async function getScoreHistory(
  params: ScoreHistoryParams,
): Promise<ScoreHistoryData | null> {
  const { data } = await safeAsync(async () => {
    const session = await getSession();
    return session ? loadScoreHistory(params) : null;
  });

  return data;
}
