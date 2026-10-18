import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export type ItemAnswerStats = { attempts: number; correct: number };

const EMPTY_STATS: ItemAnswerStats = { attempts: 0, correct: 0 };

const cachedGetItemAnswerStats = cacheAdminData(async (itemIdsKey: string) => {
  const itemIds = itemIdsKey ? itemIdsKey.split(",") : [];

  if (itemIds.length === 0) {
    return new Map<string, ItemAnswerStats>();
  }

  const rows = await prisma.attempt.groupBy({
    _count: { id: true },
    by: ["itemId", "isCorrect"],
    where: { itemId: { in: itemIds }, ...trackedAnalyticsUserRelationWhere },
  });

  return rows.reduce((stats, row) => {
    const itemId = row.itemId ?? "";
    const current = stats.get(itemId) ?? EMPTY_STATS;
    const count = row._count.id;

    return stats.set(itemId, {
      attempts: current.attempts + count,
      correct: current.correct + (row.isCorrect ? count : 0),
    });
  }, new Map<string, ItemAnswerStats>());
});

/**
 * Answer counts per item from learners' attempts, so admins can spot items
 * that are too hard, too easy or wrong. Accounts left out of analytics are
 * left out here too.
 */
export async function getItemAnswerStats(itemIds: string[]): Promise<Map<string, ItemAnswerStats>> {
  return cachedGetItemAnswerStats(itemIds.toSorted().join(","));
}

/** An item nobody answered has no attempts and no accuracy yet. */
export function readItemAnswerStats(
  stats: Map<string, ItemAnswerStats>,
  itemId: string,
): ItemAnswerStats {
  return stats.get(itemId) ?? EMPTY_STATS;
}

/** Share of correct answers, or null before anyone answered. */
export function getItemAccuracy({ attempts, correct }: ItemAnswerStats): number | null {
  return attempts === 0 ? null : (correct / attempts) * 100;
}
