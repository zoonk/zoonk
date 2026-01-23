import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { getPeakTime as getPeakTimeQuery } from "@zoonk/db/peak-time";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { type ScoredRow, findBestByScore, getDefaultStartDate } from "./_utils";

export type BestTimeData = {
  score: number;
  period: number;
};

export type BestTimeParams = {
  headers?: Headers;
  startDate?: Date;
  endDate?: Date;
};

const cachedGetBestTime = cache(
  async (startDateIso: string | undefined, headers?: Headers): Promise<BestTimeData | null> => {
    const session = await getSession({ headers });
    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const startDate = getDefaultStartDate(startDateIso);

    const { data: results, error } = await safeAsync(() =>
      prisma.$queryRawTyped(getPeakTimeQuery(userId, startDate)),
    );

    if (error || !results || results.length === 0) {
      return null;
    }

    const rows: ScoredRow[] = results.map((row) => ({
      correct: Number(row.correct),
      incorrect: Number(row.incorrect),
      key: Number(row.period),
    }));

    const best = findBestByScore(rows);
    return best ? { period: best.key, score: best.score } : null;
  },
);

export function getBestTime(params?: BestTimeParams): Promise<BestTimeData | null> {
  return cachedGetBestTime(params?.startDate?.toISOString(), params?.headers);
}
