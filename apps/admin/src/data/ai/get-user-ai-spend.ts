import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

const USER_SPEND_DAYS = 30;

/**
 * What one learner's AI calls cost over the last 30 days, per task, most expensive first. The user
 * page reads it inside its `"use cache: private"` section, which keeps the time it was read, so the
 * clock is read here rather than behind `connection()`, which a private cache can't call.
 */
export const getUserAiSpend = cacheAdminData(async (userId: string) => {
  const since = new Date(Date.now() - USER_SPEND_DAYS * MS_PER_DAY);

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
