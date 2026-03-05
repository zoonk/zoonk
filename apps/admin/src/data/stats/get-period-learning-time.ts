import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getPeriodLearningTime = cache(async (start: Date, end: Date) => {
  const result = await prisma.dailyProgress.aggregate({
    _sum: { timeSpentSeconds: true },
    where: { date: { gte: start, lte: end } },
  });

  return result._sum.timeSpentSeconds ?? 0;
});
