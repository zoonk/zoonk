import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

/**
 * Lesson rows in the learning ledger are the started lessons: finished ones have an end time, and
 * backfilled legacy lessons that were never finished keep it empty.
 */
export const getCompletionRate = cacheAdminData(async () => {
  const where = { ...trackedAnalyticsUserRelationWhere, kind: "lesson" } as const;

  const [started, completed] = await Promise.all([
    prisma.learningEvent.count({ where }),
    prisma.learningEvent.count({ where: { ...where, endedAt: { not: null } } }),
  ]);

  return started === 0 ? 0 : (completed / started) * 100;
});
