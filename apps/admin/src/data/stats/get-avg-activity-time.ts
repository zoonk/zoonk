import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getAvgActivityTime = cache(async () => {
  const result = await prisma.activityProgress.aggregate({
    _avg: { durationSeconds: true },
    where: { durationSeconds: { not: null } },
  });

  return result._avg.durationSeconds ?? 0;
});
