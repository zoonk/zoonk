import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { ContentFeedbackReason, type FeedbackContentKind, prisma } from "@zoonk/db";

/** Below this many votes a rate swings on one learner, so the group is listed after the ranking. */
export const MIN_VOTES_FOR_RATE = 20;

const TOP_REASON_LIMIT = 3;
const PERCENT = 100;

type GroupKey = {
  contentKind: FeedbackContentKind;
  model: string | null;
  promptVersion: string | null;
};

export type DownvoteRateGroup = GroupKey & {
  downvotes: number;
  rate: number;
  topReasons: { count: number; reason: ContentFeedbackReason }[];
  votes: number;
};

const groupBy = ["model", "promptVersion", "contentKind"] as const;

function toGroupId(group: GroupKey): string {
  return [group.model, group.promptVersion, group.contentKind].join("|");
}

/** One grouped count per reason keeps the counting in the database instead of loading every vote. */
async function countReasonsByGroup() {
  const reasons = Object.values(ContentFeedbackReason);

  const countsByReason = await Promise.all(
    reasons.map((reason) =>
      prisma.contentFeedback.groupBy({
        _count: { id: true },
        by: [...groupBy],
        where: { reasons: { has: reason }, vote: "down" },
      }),
    ),
  );

  return reasons.flatMap((reason, index) =>
    (countsByReason[index] ?? []).map((row) => ({
      count: row._count.id,
      groupId: toGroupId(row),
      reason,
    })),
  );
}

function readTopReasons(
  reasonCounts: Awaited<ReturnType<typeof countReasonsByGroup>>,
  groupId: string,
): DownvoteRateGroup["topReasons"] {
  return reasonCounts
    .filter((row) => row.groupId === groupId)
    .toSorted((a, b) => b.count - a.count)
    .slice(0, TOP_REASON_LIMIT)
    .map(({ count, reason }) => ({ count, reason }));
}

function compareByRate(a: DownvoteRateGroup, b: DownvoteRateGroup): number {
  return b.rate - a.rate || b.votes - a.votes;
}

/**
 * Downvote rates per model, prompt version and content kind, with the reasons learners picked most.
 * Groups with enough votes are ranked by rate so the screens to regenerate first come first.
 */
export const listDownvoteRates = cacheAdminData(async () => {
  const [voteCounts, reasonCounts] = await Promise.all([
    prisma.contentFeedback.groupBy({
      _count: { id: true },
      by: [...groupBy, "vote"],
      where: { vote: { not: null } },
    }),
    countReasonsByGroup(),
  ]);

  const totals = voteCounts.reduce((groups, row) => {
    const groupId = toGroupId(row);
    const current = groups.get(groupId);
    const downvotes = row.vote === "down" ? row._count.id : 0;

    return groups.set(groupId, {
      contentKind: row.contentKind,
      downvotes: (current?.downvotes ?? 0) + downvotes,
      model: row.model,
      promptVersion: row.promptVersion,
      votes: (current?.votes ?? 0) + row._count.id,
    });
  }, new Map<string, GroupKey & { downvotes: number; votes: number }>());

  const groups = [...totals.entries()].map(([groupId, group]) => ({
    ...group,
    rate: (group.downvotes / group.votes) * PERCENT,
    topReasons: readTopReasons(reasonCounts, groupId),
  }));

  return {
    ranked: groups.filter((group) => group.votes >= MIN_VOTES_FOR_RATE).toSorted(compareByRate),
    unranked: groups
      .filter((group) => group.votes < MIN_VOTES_FOR_RATE)
      .toSorted((a, b) => b.votes - a.votes || compareByRate(a, b)),
  };
});
