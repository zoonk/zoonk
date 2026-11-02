import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getPeriodCompletionRate = cacheAdminData(async (start: Date, end: Date) => {
  const where = {
    ...trackedAnalyticsUserRelationWhere,
    kind: "lesson",
    startedAt: { gte: start, lte: end },
  } as const;

  const [started, completed] = await Promise.all([
    prisma.learningEvent.count({ where }),
    prisma.learningEvent.count({ where: { ...where, endedAt: { not: null } } }),
  ]);

  return started === 0 ? 0 : (completed / started) * 100;
});
