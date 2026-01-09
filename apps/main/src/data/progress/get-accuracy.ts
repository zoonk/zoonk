import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type AccuracyData = {
  accuracy: number;
};

export const getAccuracy = cache(
  async (params?: { headers?: Headers }): Promise<AccuracyData | null> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

    const { data: result, error } = await safeAsync(() =>
      prisma.dailyProgress.aggregate({
        // biome-ignore lint/style/useNamingConvention: Prisma aggregate uses _sum convention
        _sum: {
          correctAnswers: true,
          incorrectAnswers: true,
        },
        where: {
          date: { gte: threeMonthsAgo },
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

    const accuracy = (correct / total) * 100;

    return {
      accuracy,
    };
  },
);
