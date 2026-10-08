import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { getAiSpendSince } from "./_utils/ai-spend-since";

const USER_SPEND_DAYS = 30;

/** What one learner's AI calls cost over the last 30 days, per task, most expensive first. */
export const getUserAiSpend = cacheAdminData(async (userId: string) => {
  const since = await getAiSpendSince(USER_SPEND_DAYS);

  const rows = await prisma.aiCall.groupBy({
    _count: { id: true },
    _sum: { costUsd: true },
    by: ["task"],
    orderBy: { _sum: { costUsd: "desc" } },
    where: { createdAt: { gte: since }, userId },
  });

  return {
    days: USER_SPEND_DAYS,
    tasks: rows.map((row) => ({
      calls: row._count.id,
      costUsd: row._sum.costUsd ?? 0,
      task: row.task,
    })),
  };
});
