import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type Sql, prisma, sql } from "@zoonk/db";
import { type ScoredRow, findBestByScore } from "@zoonk/utils/aggregation";
import { getDefaultStartDate } from "@zoonk/utils/date-ranges";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";

type BestTimeData = { score: number; period: number };

type BestTimeParams = { endDate?: Date; startDate?: Date };

type BestTimeRow = { correct: number | null; incorrect: number | null; period: number | null };

/**
 * Historical score views need the same closed date window for insight cards as
 * they use for the chart. The end filter stays optional so homepage summaries
 * can keep their default rolling lookback without pretending there is a fixed
 * period end.
 */
function getAnsweredAtEndFilter({ endDate }: { endDate?: Date }): Sql {
  if (!endDate) {
    return sql`TRUE`;
  }

  return sql`answered_at <= ${endDate}`;
}

async function findBestTime({
  endDate,
  startDate,
  userId,
}: BestTimeParams & { userId: string }): Promise<BestTimeData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const resolvedStartDate = startDate ?? getDefaultStartDate();
  const answeredAtEndFilter = getAnsweredAtEndFilter({ endDate });

  const results = await prisma.$queryRaw<BestTimeRow[]>`
    SELECT
      CASE
        WHEN hour_of_day BETWEEN 0 AND 5 THEN 0
        WHEN hour_of_day BETWEEN 6 AND 11 THEN 1
        WHEN hour_of_day BETWEEN 12 AND 17 THEN 2
        ELSE 3
      END AS "period",
      COUNT(*) FILTER (WHERE is_correct = true)::int AS "correct",
      COUNT(*) FILTER (WHERE is_correct = false)::int AS "incorrect"
    FROM step_attempts
    WHERE user_id = ${userId} AND answered_at >= ${resolvedStartDate}
      AND ${answeredAtEndFilter}
    GROUP BY 1
    HAVING COUNT(*) FILTER (WHERE is_correct = true) + COUNT(*) FILTER (WHERE is_correct = false) > 0
  `;

  if (results.length === 0) {
    return null;
  }

  const rows: ScoredRow[] = results.map((row) => ({
    correct: row.correct ?? 0,
    incorrect: row.incorrect ?? 0,
    key: row.period ?? 0,
  }));

  const best = findBestByScore(rows);
  return best ? { period: best.key, score: best.score } : null;
}

/** Returns the authenticated learner's strongest time of day for the selected period. */
export async function getBestTime(params: BestTimeParams = {}): Promise<BestTimeData | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { data } = await safeAsync(() => findBestTime({ ...params, userId: session.user.id }));
  return data ?? null;
}
