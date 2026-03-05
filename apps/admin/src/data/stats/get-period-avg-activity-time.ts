import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getPeriodAvgActivityTime = cache(async (start: Date, end: Date) => {
  const result = await prisma.activityProgress.aggregate({
    _avg: { durationSeconds: true },
    where: {
      completedAt: { gte: start, lte: end },
      durationSeconds: { not: null },
    },
  });

  return result._avg.durationSeconds ?? 0;
});
