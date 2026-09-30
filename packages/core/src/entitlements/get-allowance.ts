import "server-only";
import { type UsageKind, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getAllowanceCacheTag, getUserSubscriptionCacheTag } from "../cache/tags";
import { type AllowanceCounts, toAllowance } from "./_utils/allowance-view";
import { getEntitlementViewer } from "./_utils/entitlement-viewer";
import { getUsagePeriodStarts } from "./_utils/usage-periods";
import { type Allowance } from "./contract";

async function countByKind({ since, userId }: { since?: Date; userId: string }) {
  const groups = await prisma.usageRecord.groupBy({
    _count: { id: true },
    by: ["kind"],
    where: { userId, ...(since && { createdAt: { gte: since } }) },
  });

  return new Map<UsageKind, number>(groups.map((group) => [group.kind, group._count.id]));
}

async function countAllowanceUsage({
  now,
  userId,
}: {
  now: Date;
  userId: string;
}): Promise<AllowanceCounts> {
  const starts = getUsagePeriodStarts(now);

  const [day, month, total, generatedLessons, activeGoals] = await Promise.all([
    countByKind({ since: starts.day, userId }),
    countByKind({ since: starts.month, userId }),
    countByKind({ userId }),
    prisma.usageRecord.count({ where: { generated: true, kind: "lessonStart", userId } }),
    prisma.goal.count({ where: { kind: { not: "explain" }, status: "active", userId } }),
  ]);

  return { activeGoals, day, generatedLessons, month, total };
}

/**
 * Shows the learner or guest their plan and what they used: new lessons today and this month,
 * tutor messages, uploads, conversations, goals, and when the counts start over.
 */
export async function getAllowance(): Promise<Allowance | null> {
  "use cache: private";

  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return null;
  }

  cacheTag(getAllowanceCacheTag(viewer.userId), getUserSubscriptionCacheTag(viewer.userId));

  const now = new Date();
  const counts = await countAllowanceUsage({ now, userId: viewer.userId });

  return toAllowance({ counts, now, tier: viewer.tier });
}
