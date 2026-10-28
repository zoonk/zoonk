import "server-only";
import { type UsageKind, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getAllowanceCacheTag, getUserSubscriptionCacheTag } from "../cache/tags";
import { type AllowanceCounts, toAllowance } from "./_utils/allowance-view";
import { readEntitlementViewer } from "./_utils/entitlement-viewer";
import { getUsagePeriodStarts } from "./_utils/usage-periods";
import { type Allowance } from "./contract";

function countKinds(rows: readonly { kind: UsageKind }[]): Map<UsageKind, number> {
  return new Map(
    [...Map.groupBy(rows, (row) => row.kind)].map(([kind, list]) => [kind, list.length]),
  );
}

/** Live call time held or used, in seconds, as the call caps count it (see `sumCallSeconds`). */
function sumCallTime(rows: readonly { kind: UsageKind; seconds: number }[]): number {
  return rows
    .filter((row) => row.kind === "conversation")
    .reduce((sum, row) => sum + row.seconds, 0);
}

/**
 * Everything the allowance shows in three reads: all-time counts by kind (and how many lessons
 * were written new), this month's records (today's are among them), and the active goals. Claims
 * count with `countUsage`, in their own transaction.
 */
async function countAllowanceUsage({
  now,
  userId,
}: {
  now: Date;
  userId: string;
}): Promise<AllowanceCounts> {
  const starts = getUsagePeriodStarts(now);

  const [totals, thisMonth, activeGoals] = await Promise.all([
    prisma.usageRecord.groupBy({
      _count: { id: true },
      by: ["kind", "generated"],
      where: { userId },
    }),
    prisma.usageRecord.findMany({
      select: { createdAt: true, kind: true, seconds: true },
      where: { createdAt: { gte: starts.month }, userId },
    }),
    prisma.goal.count({ where: { kind: { not: "explain" }, status: "active", userId } }),
  ]);

  const today = thisMonth.filter((row) => row.createdAt >= starts.day);
  const total = new Map<UsageKind, number>();

  for (const group of totals) {
    total.set(group.kind, (total.get(group.kind) ?? 0) + group._count.id);
  }

  return {
    activeGoals,
    callSecondsThisMonth: sumCallTime(thisMonth),
    callSecondsToday: sumCallTime(today),
    day: countKinds(today),
    generatedLessons:
      totals.find((group) => group.kind === "lessonStart" && group.generated)?._count.id ?? 0,
    month: countKinds(thisMonth),
    total,
  };
}

/**
 * Shows the learner or guest their plan and what they used: new lessons today and this month,
 * tutor messages, uploads, conversations and the call time used today and this month, goals, and
 * when the counts start over.
 */
export async function getAllowance(): Promise<Allowance | null> {
  "use cache: private";

  const viewer = await readEntitlementViewer();

  if (!viewer) {
    return null;
  }

  cacheTag(getAllowanceCacheTag(viewer.userId), getUserSubscriptionCacheTag(viewer.userId));

  const now = new Date();
  const counts = await countAllowanceUsage({ now, userId: viewer.userId });

  return toAllowance({ counts, now, tier: viewer.tier });
}
