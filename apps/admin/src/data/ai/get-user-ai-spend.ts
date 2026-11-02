import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

const USER_SPEND_DAYS = 30;

/**
 * Read inside the user page's `"use cache: private"` section, which can't call `connection()`, so
 * the clock is read here.
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
