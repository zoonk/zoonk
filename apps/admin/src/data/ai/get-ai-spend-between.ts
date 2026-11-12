import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getAiSpendBetween = cacheAdminData(async (start: Date, end: Date) => {
  const totals = await prisma.aiCall.aggregate({
    _sum: { costUsd: true },
    where: { createdAt: { gte: start, lt: end } },
  });

  return totals._sum.costUsd ?? 0;
});
