import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
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

export const getScore = cache(
  async (params?: ScoreParams): Promise<ScoreData | null> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);

    // Use provided date range or default to 90 days
    let startDate: Date;
    let endDate: Date;

    if (params?.startDate && params?.endDate) {
      startDate = params.startDate;
      endDate = params.endDate;
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
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

    return {
      score,
    };
  },
);
