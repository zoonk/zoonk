import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { timedLessonWhere } from "@/data/stats/_utils/timed-lesson";
import { prisma } from "@zoonk/db";

export const getAvgLessonTime = cacheAdminData(async () => {
  const result = await prisma.learningEvent.aggregate({
    _avg: { seconds: true },
    where: { ...trackedAnalyticsUserRelationWhere, ...timedLessonWhere },
  });

  return result._avg.seconds ?? 0;
});
