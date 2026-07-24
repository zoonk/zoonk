import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";
import { resolveScoreDateRange } from "./_utils/resolve-score-date-range";
import { type ScoreRangeParams } from "./_utils/score-date-range";
import { type ScorePerformance, getScorePerformance } from "./_utils/score-performance";

/**
 * Loads only the weighted answer totals needed by compact Score surfaces such
 * as Home, while sharing the same rolling date contract as the detail page.
 */
async function findScore({
  endDate,
  startDate,
  userId,
}: {
  endDate: Date;
  startDate: Date;
  userId: string;
}): Promise<ScorePerformance | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const result = await prisma.dailyProgress.aggregate({
    _sum: { correctAnswers: true, incorrectAnswers: true },
    where: { date: { gte: startDate, lte: endDate }, userId },
  });

  return getScorePerformance({
    correctAnswers: result._sum.correctAnswers ?? 0,
    incorrectAnswers: result._sum.incorrectAnswers ?? 0,
  });
}

/**
 * Returns the authenticated learner's weighted Score. Omitted dates use the
 * canonical rolling 90-day window; explicit dates remain available to existing
 * internal callers that need a bounded historical query.
 */
export async function getScore(params: ScoreRangeParams = {}): Promise<ScorePerformance | null> {
  const { data } = await safeAsync(async () => {
    const [dateRange, session] = await Promise.all([resolveScoreDateRange(params), getSession()]);

    if (!session) {
      return null;
    }

    return findScore({ ...dateRange.dailyProgress, userId: session.user.id });
  });

  return data ?? null;
}
