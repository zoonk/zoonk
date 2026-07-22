import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/date-ranges";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";

type ScoreData = { score: number };

type ScoreParams = { endDate?: Date; startDate?: Date };

/**
 * Keeps the rolling default inside the query scope so omitted dates share one
 * cache key instead of creating a unique timestamp key on every request.
 */
function getDateRange({ endDate, startDate }: ScoreParams): { startDate: Date; endDate: Date } {
  if (startDate && endDate) {
    return { endDate, startDate };
  }

  const resolvedEndDate = new Date();
  const resolvedStartDate = new Date();
  resolvedStartDate.setDate(resolvedStartDate.getDate() - DEFAULT_PROGRESS_LOOKBACK_DAYS);
  return { endDate: resolvedEndDate, startDate: resolvedStartDate };
}

function calculateScoreFromTotals(correct: number, incorrect: number): number | null {
  const total = correct + incorrect;

  if (total === 0) {
    return null;
  }

  return (correct / total) * 100;
}

async function findScore({
  endDate,
  startDate,
  userId,
}: ScoreParams & { userId: string }): Promise<ScoreData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const dateRange = getDateRange({ endDate, startDate });

  const result = await prisma.dailyProgress.aggregate({
    _sum: { correctAnswers: true, incorrectAnswers: true },
    where: { date: { gte: dateRange.startDate, lte: dateRange.endDate }, userId },
  });

  const score = calculateScoreFromTotals(
    result._sum.correctAnswers ?? 0,
    result._sum.incorrectAnswers ?? 0,
  );

  return score === null ? null : { score };
}

/** Returns the authenticated learner's score for the selected period. */
export async function getScore(params: ScoreParams = {}): Promise<ScoreData | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { data } = await safeAsync(() => findScore({ ...params, userId: session.user.id }));
  return data ?? null;
}
