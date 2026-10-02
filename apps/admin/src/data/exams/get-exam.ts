import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { redactSourceTitle } from "@/data/sources/_utils/source-title";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

const cachedGetExam = cacheAdminData(async (examBlueprintId: string) => {
  const exam = await prisma.examBlueprint.findUnique({
    include: {
      _count: {
        select: {
          changeNotices: true,
          goals: { where: trackedAnalyticsUserRelationWhere },
          items: true,
        },
      },
      source: { select: { id: true, title: true, visibility: true } },
    },
    where: { id: examBlueprintId },
  });

  return exam ? { ...exam, source: exam.source ? redactSourceTitle(exam.source) : null } : null;
});

/** One exam blueprint with its structure, current edition and the source it was read from. */
export async function getExam(examBlueprintId: string) {
  return cachedGetExam(examBlueprintId);
}
