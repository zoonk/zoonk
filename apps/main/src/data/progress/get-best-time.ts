import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { type ScoredRow, findBestByScore } from "@zoonk/utils/aggregation";
import { getDefaultStartDate } from "@zoonk/utils/date-ranges";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

type BestTimeData = {
  score: number;
  period: number;
};

const cachedGetBestTime = cache(
  async (startDateIso?: string, headers?: Headers): Promise<BestTimeData | null> => {
    const session = await getSession(headers);
    if (!session) {
      return null;
    }

    const userId = session.user.id;
    const startDate = getDefaultStartDate(startDateIso);

    const { data: results, error } = await safeAsync(
      () =>
        prisma.$queryRaw<
          { period: number | null; correct: number | null; incorrect: number | null }[]
        >`
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
        WHERE user_id = ${userId} AND answered_at >= ${startDate}
        GROUP BY 1
        HAVING COUNT(*) FILTER (WHERE is_correct = true) + COUNT(*) FILTER (WHERE is_correct = false) > 0
      `,
    );

    if (error || !results || results.length === 0) {
      return null;
    }

    const rows: ScoredRow[] = results.map((row) => ({
      correct: row.correct ?? 0,
      incorrect: row.incorrect ?? 0,
      key: row.period ?? 0,
    }));

    const best = findBestByScore(rows);
    return best ? { period: best.key, score: best.score } : null;
  },
);

export function getBestTime(params?: {
  headers?: Headers;
  startDate?: Date;
  endDate?: Date;
}): Promise<BestTimeData | null> {
  return cachedGetBestTime(params?.startDate?.toISOString(), params?.headers);
}
