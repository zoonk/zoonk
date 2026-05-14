import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { type ScoredRow, findBestByScore } from "@zoonk/utils/aggregation";
import { getDefaultStartDate } from "@zoonk/utils/date-ranges";
import { cache } from "react";

type BestDayData = { score: number; dayOfWeek: number };

const cachedGetBestDay = cache(
  async (
    startDateIso?: string,
    endDateIso?: string,
    headers?: Headers,
  ): Promise<BestDayData | null> => {
    const session = await getSession(headers);

    if (!session) {
      return null;
    }

    const userId = session.user.id;
    const startDate = getDefaultStartDate(startDateIso);
    const endDate = endDateIso ? new Date(endDateIso) : undefined;
    const dateFilter = endDate ? { gte: startDate, lte: endDate } : { gte: startDate };

    const results = await prisma.dailyProgress.groupBy({
      _sum: { correctAnswers: true, incorrectAnswers: true },
      by: ["dayOfWeek"],
      where: { date: dateFilter, userId },
    });

    if (results.length === 0) {
      return null;
    }

    const rows: ScoredRow[] = results.map((row) => ({
      correct: row._sum.correctAnswers ?? 0,
      incorrect: row._sum.incorrectAnswers ?? 0,
      key: row.dayOfWeek,
    }));

    const best = findBestByScore(rows);
    return best ? { dayOfWeek: best.key, score: best.score } : null;
  },
);

/**
 * Score insights use this for both rolling summaries and fixed historical
 * periods. Keeping the end date optional lets the homepage keep its rolling
 * lookback while score-page history can prevent future progress from affecting
 * a previous period.
 */
export function getBestDay(params?: {
  endDate?: Date;
  headers?: Headers;
  startDate?: Date;
}): Promise<BestDayData | null> {
  return cachedGetBestDay(
    params?.startDate?.toISOString(),
    params?.endDate?.toISOString(),
    params?.headers,
  );
}
