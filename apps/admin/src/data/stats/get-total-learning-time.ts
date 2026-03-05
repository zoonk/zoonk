import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getTotalLearningTime = cache(async () => {
  const result = await prisma.dailyProgress.aggregate({
    _sum: { timeSpentSeconds: true },
  });

  return result._sum.timeSpentSeconds ?? 0;
});
