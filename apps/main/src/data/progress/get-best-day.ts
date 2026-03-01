import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { type ScoredRow, findBestByScore, getDefaultStartDate } from "@zoonk/utils/date-ranges";
import { cache } from "react";

type BestDayData = {
  score: number;
  dayOfWeek: number;
};

const cachedGetBestDay = cache(
  async (startDateIso: string | undefined, headers?: Headers): Promise<BestDayData | null> => {
    const session = await getSession(headers);
    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const startDate = getDefaultStartDate(startDateIso);

    const results = await prisma.dailyProgress.groupBy({
      _sum: { correctAnswers: true, incorrectAnswers: true },
      by: ["dayOfWeek"],
      where: { date: { gte: startDate }, userId },
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

export function getBestDay(params?: {
  headers?: Headers;
  startDate?: Date;
}): Promise<BestDayData | null> {
  return cachedGetBestDay(params?.startDate?.toISOString(), params?.headers);
}
