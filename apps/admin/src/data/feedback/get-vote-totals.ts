import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type FeedbackContentKind, prisma } from "@zoonk/db";

export type VoteTotals = { down: number; up: number };

const EMPTY_TOTALS: VoteTotals = { down: 0, up: 0 };

const cachedGetVoteTotals = cacheAdminData(
  async (contentKind: FeedbackContentKind, contentIdsKey: string) => {
    const contentIds = contentIdsKey ? contentIdsKey.split(",") : [];

    if (contentIds.length === 0) {
      return new Map<string, VoteTotals>();
    }

    const rows = await prisma.contentFeedback.groupBy({
      _count: { id: true },
      by: ["contentId", "vote"],
      where: { contentId: { in: contentIds }, contentKind, vote: { not: null } },
    });

    return rows.reduce((totals, row) => {
      const current = totals.get(row.contentId) ?? EMPTY_TOTALS;
      const vote = row.vote === "up" ? "up" : "down";

      return totals.set(row.contentId, { ...current, [vote]: current[vote] + row._count.id });
    }, new Map<string, VoteTotals>());
  },
);

/**
 * Up and down votes per piece of content, for the vote columns on lesson, step,
 * item and question pages. Votes store a plain content id, so totals survive
 * the content being regenerated.
 */
export async function getVoteTotals({
  contentIds,
  contentKind,
}: {
  contentIds: string[];
  contentKind: FeedbackContentKind;
}): Promise<Map<string, VoteTotals>> {
  return cachedGetVoteTotals(contentKind, contentIds.toSorted().join(","));
}

/** A piece of content nobody voted on has zero of each. */
export function readVoteTotals(totals: Map<string, VoteTotals>, contentId: string): VoteTotals {
  return totals.get(contentId) ?? EMPTY_TOTALS;
}
