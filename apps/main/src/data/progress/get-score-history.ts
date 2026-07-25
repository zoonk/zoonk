import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type ScoreRangeParams } from "@zoonk/core/progress/score-date-range";
import { prisma } from "@zoonk/db";
import { formatLabel } from "@zoonk/utils/chart";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";
import { resolveScoreDateRange } from "./_utils/resolve-score-date-range";
import {
  type DatedAnswerCounts,
  type ScorePerformance,
  getCombinedScorePerformance,
  getWeeklyScorePerformance,
} from "./_utils/score-performance";

type ScoreTrendDataPoint = ScorePerformance & { date: Date; label: string };

export type ScoreHistoryData = ScorePerformance & {
  dataPoints: ScoreTrendDataPoint[];
  periodEnd: Date;
  periodStart: Date;
};

type ScoreHistoryParams = ScoreRangeParams & { locale?: string };

/**
 * Converts one DailyProgress row into the answer-count shape used by weighted
 * Score aggregation without coupling the pure helper to Prisma models.
 */
function toDatedAnswerCounts(row: DatedAnswerCounts): DatedAnswerCounts {
  return {
    correctAnswers: row.correctAnswers,
    date: row.date,
    incorrectAnswers: row.incorrectAnswers,
  };
}

/**
 * Builds one rolling Score result from the same rows used by its weekly trend,
 * guaranteeing the headline and chart cannot drift to different denominators.
 */
function buildScoreHistory({
  endDate,
  locale,
  rows,
  startDate,
}: {
  endDate: Date;
  locale: string;
  rows: DatedAnswerCounts[];
  startDate: Date;
}): ScoreHistoryData | null {
  const performance = getCombinedScorePerformance(rows);

  if (!performance) {
    return null;
  }

  const dataPoints = getWeeklyScorePerformance(rows).map((point) => ({
    ...point,
    label: formatLabel(point.date, "month", locale),
  }));

  return { ...performance, dataPoints, periodEnd: endDate, periodStart: startDate };
}

/**
 * Reads already-resolved date-only boundaries under one progress cache key.
 * Resolving the request timezone before this leaf keeps request APIs out of the
 * shared cache while every locale can reuse the same persistence rows.
 */
async function findScoreHistoryRows({
  endDate,
  startDate,
  userId,
}: {
  endDate: Date;
  startDate: Date;
  userId: string;
}): Promise<DatedAnswerCounts[]> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const rows = await prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    where: { date: { gte: startDate, lte: endDate }, userId },
  });

  return rows.map((row) => toDatedAnswerCounts(row));
}

/**
 * Returns the learner's weighted rolling Score and weekly trend. Locale affects
 * labels only; every locale reads the same fixed 90-day answer window.
 */
export async function getScoreHistory({
  endDate,
  locale = "en",
  now,
  startDate,
  timeZone,
}: ScoreHistoryParams = {}): Promise<ScoreHistoryData | null> {
  const { data } = await safeAsync(async () => {
    const [dateRange, session] = await Promise.all([
      resolveScoreDateRange({ endDate, now, startDate, timeZone }),
      getSession(),
    ]);

    if (!session) {
      return null;
    }

    const rows = await findScoreHistoryRows({
      ...dateRange.dailyProgress,
      userId: session.user.id,
    });

    return buildScoreHistory({ ...dateRange.dailyProgress, locale, rows });
  });

  return data ?? null;
}
