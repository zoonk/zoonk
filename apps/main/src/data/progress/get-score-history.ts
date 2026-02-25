import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import {
  type HistoryPeriod,
  aggregateScoreByMonth,
  aggregateScoreByWeek,
  calculateDateRanges,
  formatLabel,
} from "./_utils";

export type ScorePeriod = HistoryPeriod;

export type ScoreDataPoint = {
  date: Date;
  score: number;
  label: string;
};

type ScoreHistoryData = {
  dataPoints: ScoreDataPoint[];
  average: number;
  previousAverage: number | null;
  periodStart: Date;
  periodEnd: Date;
  hasPreviousPeriod: boolean;
  hasNextPeriod: boolean;
};

type RawDataPoint = {
  date: Date;
  correct: number;
  incorrect: number;
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

async function fetchDailyData(
  userId: number,
  start: Date,
  end: Date,
): Promise<{ data: RawDataPoint[] | null; error: unknown }> {
  const result = await safeAsync(() =>
    prisma.dailyProgress.findMany({
      orderBy: { date: "asc" },
      where: { date: { gte: start, lte: end }, userId },
    }),
  );

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  return {
    data: result.data.map((row) => ({
      correct: row.correctAnswers,
      date: row.date,
      incorrect: row.incorrectAnswers,
    })),
    error: null,
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
    return aggregateScoreByWeek(rawData, calculateScore);
  }

  return aggregateScoreByMonth(rawData, calculateScore);
}

function filterValidData(data: RawDataPoint[]): RawDataPoint[] {
  return data.filter((point) => point.correct + point.incorrect > 0);
}

function getPreviousAverage(
  previousData: RawDataPoint[] | null,
  period: ScorePeriod,
): number | null {
  const valid = filterValidData(previousData ?? []);
  if (valid.length === 0) {
    return null;
  }
  const processed = processScoreData(valid, period);
  return processed.length > 0 ? calculateAverage(processed) : null;
}

async function hasEarlierScoreData(userId: number, beforeDate: Date): Promise<boolean> {
  const { data } = await safeAsync(() =>
    prisma.dailyProgress.findFirst({
      where: {
        OR: [{ correctAnswers: { gt: 0 } }, { incorrectAnswers: { gt: 0 } }],
        date: { lt: beforeDate },
        userId,
      },
    }),
  );
  return Boolean(data);
}

const cachedGetScoreHistory = cache(
  async (
    period: ScorePeriod,
    offset: number,
    locale: string,
    headers?: Headers,
  ): Promise<ScoreHistoryData | null> => {
    const session = await getSession(headers);
    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const { current, previous } = calculateDateRanges(period, offset);

    const [currentResult, previousResult] = await Promise.all([
      fetchDailyData(userId, current.start, current.end),
      fetchDailyData(userId, previous.start, previous.end),
    ]);

    if (currentResult.error || !currentResult.data) {
      return null;
    }

    const validData = filterValidData(currentResult.data);
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
      hasPreviousPeriod: await hasEarlierScoreData(userId, current.start),
      periodEnd: current.end,
      periodStart: current.start,
      previousAverage: getPreviousAverage(previousResult.data, period),
    };
  },
);

export function getScoreHistory(params: {
  period: ScorePeriod;
  offset?: number;
  locale?: string;
  headers?: Headers;
}): Promise<ScoreHistoryData | null> {
  return cachedGetScoreHistory(
    params.period,
    params.offset ?? 0,
    params.locale ?? "en",
    params.headers,
  );
}
