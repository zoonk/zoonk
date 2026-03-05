import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getPeriodCompletionRate = cache(async (start: Date, end: Date) => {
  const where = { startedAt: { gte: start, lte: end } };

  const [started, completed] = await Promise.all([
    prisma.activityProgress.count({ where }),
    prisma.activityProgress.count({ where: { ...where, completedAt: { not: null } } }),
  ]);

  return started === 0 ? 0 : (completed / started) * 100;
});
