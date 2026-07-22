import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { type ScoredRow, findBestByScore } from "@zoonk/utils/aggregation";
import { getDefaultStartDate } from "@zoonk/utils/date-ranges";
import { cacheTag } from "next/cache";

type BestDayData = { score: number; dayOfWeek: number };

type BestDayParams = { endDate?: Date; startDate?: Date };

async function findBestDay({
  endDate,
  startDate,
  userId,
}: BestDayParams & { userId: string }): Promise<BestDayData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const resolvedStartDate = startDate ?? getDefaultStartDate();

  const dateFilter = endDate
    ? { gte: resolvedStartDate, lte: endDate }
    : { gte: resolvedStartDate };

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
}

/** Returns the authenticated learner's strongest weekday for the selected period. */
export async function getBestDay(params: BestDayParams = {}): Promise<BestDayData | null> {
  const session = await getSession();
  return session ? findBestDay({ ...params, userId: session.user.id }) : null;
}
