import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import {
  aggregateScoreByMonth,
  aggregateScoreByWeek,
  calculateDateRanges,
  formatLabel,
  type HistoryPeriod,
} from "./_utils";

export type ScorePeriod = HistoryPeriod;

export type ScoreDataPoint = {
  date: Date;
  score: number;
  label: string;
};

export type ScoreHistoryData = {
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

export type ScoreHistoryParams = {
  period: ScorePeriod;
  offset?: number;
  locale?: string;
  headers?: Headers;
};

async function fetchDailyData(
  userId: number,
  start: Date,
  end: Date,
): Promise<{ data: RawDataPoint[] | null; error: unknown }> {
  const result = await safeAsync(() =>
    prisma.dailyProgress.findMany({
      orderBy: { date: "asc" },
      select: { correctAnswers: true, date: true, incorrectAnswers: true },
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
  // For month view, calculate daily score
  if (period === "month") {
    return rawData.map((point) => ({
      date: point.date,
      score: calculateScore(point.correct, point.incorrect),
    }));
  }

  // For 6 months view, aggregate by week
  if (period === "6months") {
    return aggregateScoreByWeek(rawData, calculateScore);
  }

  // For year view, aggregate by month
  return aggregateScoreByMonth(rawData, calculateScore);
}

export const getScoreHistory = cache(
  async (params: ScoreHistoryParams): Promise<ScoreHistoryData | null> => {
    const session = await getSession({ headers: params.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const { period, offset = 0, locale = "en" } = params;
    const { current, previous } = calculateDateRanges(period, offset);

    const [currentResult, previousResult] = await Promise.all([
      fetchDailyData(userId, current.start, current.end),
      fetchDailyData(userId, previous.start, previous.end),
    ]);

    if (currentResult.error || !currentResult.data) {
      return null;
    }

    const rawData = currentResult.data;

    // Filter out days with no answers (0 correct + 0 incorrect)
    const validData = rawData.filter(
      (point) => point.correct + point.incorrect > 0,
    );

    if (validData.length === 0) {
      return null;
    }

    const currentData = processScoreData(validData, period);

    const dataPoints: ScoreDataPoint[] = currentData.map((row) => ({
      date: row.date,
      label: formatLabel(row.date, period, locale),
      score: row.score,
    }));

    const average = calculateAverage(currentData);

    // Also process previous period for comparison
    const previousRaw = previousResult.data ?? [];
    const previousValid = previousRaw.filter(
      (point) => point.correct + point.incorrect > 0,
    );
    const previousData =
      previousValid.length > 0 ? processScoreData(previousValid, period) : [];
    const previousAverage =
      previousData.length > 0 ? calculateAverage(previousData) : null;

    // Check if there's data before the current period
    const { data: earlierData } = await safeAsync(() =>
      prisma.dailyProgress.findFirst({
        select: { id: true },
        where: {
          date: { lt: current.start },
          OR: [{ correctAnswers: { gt: 0 } }, { incorrectAnswers: { gt: 0 } }],
          userId,
        },
      }),
    );

    const hasPreviousPeriod = Boolean(earlierData);
    const hasNextPeriod = offset > 0;

    return {
      average,
      dataPoints,
      hasNextPeriod,
      hasPreviousPeriod,
      periodEnd: current.end,
      periodStart: current.start,
      previousAverage,
    };
  },
);
