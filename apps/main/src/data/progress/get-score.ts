import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type ScoreData = {
  score: number;
};

export type ScoreParams = {
  headers?: Headers;
  startDate?: Date;
  endDate?: Date;
};

const cachedGetScore = cache(
  async (
    startDateIso: string | undefined,
    endDateIso: string | undefined,
    headers?: Headers,
  ): Promise<ScoreData | null> => {
    const session = await getSession({ headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);

    let startDate: Date;
    let endDate: Date;

    if (startDateIso && endDateIso) {
      startDate = new Date(startDateIso);
      endDate = new Date(endDateIso);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - DEFAULT_PROGRESS_LOOKBACK_DAYS);
    }

    const { data: result, error } = await safeAsync(() =>
      prisma.dailyProgress.aggregate({
        _sum: {
          correctAnswers: true,
          incorrectAnswers: true,
        },
        where: {
          date: { gte: startDate, lte: endDate },
          userId,
        },
      }),
    );

    if (error || !result) {
      return null;
    }

    const correct = result._sum.correctAnswers ?? 0;
    const incorrect = result._sum.incorrectAnswers ?? 0;
    const total = correct + incorrect;

    if (total === 0) {
      return null;
    }

    const score = (correct / total) * 100;

    return { score };
  },
);

export function getScore(params?: ScoreParams): Promise<ScoreData | null> {
  return cachedGetScore(
    params?.startDate?.toISOString(),
    params?.endDate?.toISOString(),
    params?.headers,
  );
}
