import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getAvgLessonTime = cacheAdminData(async () => {
  const result = await prisma.lessonProgress.aggregate({
    _avg: { durationSeconds: true },
    where: { ...trackedAnalyticsUserRelationWhere, durationSeconds: { not: null } },
  });

  return result._avg.durationSeconds ?? 0;
});
