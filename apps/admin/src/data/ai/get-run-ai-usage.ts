import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/** The tokens and cost of the AI call that wrote a row, found by the row's run id. */
export const getRunAiUsage = cacheAdminData(async (runId: string) => {
  const usage = await prisma.aiCall.aggregate({
    _count: { id: true },
    _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    where: { runId },
  });

  if (usage._count.id === 0) {
    return null;
  }

  return {
    costUsd: usage._sum.costUsd,
    inputTokens: usage._sum.inputTokens ?? 0,
    outputTokens: usage._sum.outputTokens ?? 0,
  };
});
