import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { getAiSpendSince } from "./_utils/ai-spend-since";

/**
 * Every AI call of the period added up: what it cost at our price list, what the gateway estimated
 * at list price (they drift apart when a price changes before our list does), how many calls the
 * list couldn't price, and how much input was read from a prompt cache.
 */
export const getAiSpendSummary = cacheAdminData(async (days: number) => {
  const since = await getAiSpendSince(days);

  const [totals, unpriced] = await Promise.all([
    prisma.aiCall.aggregate({
      _count: { id: true },
      _sum: {
        cacheReadTokens: true,
        costUsd: true,
        gatewayCostUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
      where: { createdAt: { gte: since } },
    }),
    prisma.aiCall.count({ where: { costUsd: null, createdAt: { gte: since } } }),
  ]);

  return {
    cacheReadTokens: totals._sum.cacheReadTokens ?? 0,
    calls: totals._count.id,
    costUsd: totals._sum.costUsd ?? 0,
    gatewayCostUsd: totals._sum.gatewayCostUsd ?? 0,
    inputTokens: totals._sum.inputTokens ?? 0,
    outputTokens: totals._sum.outputTokens ?? 0,
    unpricedCalls: unpriced,
  };
});
