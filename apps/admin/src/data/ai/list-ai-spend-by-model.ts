import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { getAiSpendSince } from "./_utils/ai-spend-since";

/**
 * Spend per model and the tier that served it, most expensive first, with the tokens behind it
 * and the gateway's list-price estimate beside our own cost.
 */
export const listAiSpendByModel = cacheAdminData(async (days: number) => {
  const since = await getAiSpendSince(days);

  const rows = await prisma.aiCall.groupBy({
    _count: { id: true },
    _sum: {
      cacheReadTokens: true,
      cacheWriteTokens: true,
      costUsd: true,
      gatewayCostUsd: true,
      inputTokens: true,
      outputTokens: true,
    },
    by: ["model", "serviceTier"],
    orderBy: { _sum: { costUsd: "desc" } },
    where: { createdAt: { gte: since } },
  });

  return rows.map((row) => ({
    cacheReadTokens: row._sum.cacheReadTokens ?? 0,
    cacheWriteTokens: row._sum.cacheWriteTokens ?? 0,
    calls: row._count.id,
    costUsd: row._sum.costUsd ?? 0,
    gatewayCostUsd: row._sum.gatewayCostUsd,
    inputTokens: row._sum.inputTokens ?? 0,
    model: row.model,
    outputTokens: row._sum.outputTokens ?? 0,
    serviceTier: row.serviceTier,
  }));
});
