import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { getUsagePeriodStarts } from "./usage-periods";

export type UsageCounts = {
  activeGoals: number;
  day: number;
  generatedTotal: number;
  lastUsedAt: Date | null;
  month: number;
  spentTodayMicros: number;
  total: number;
};

/** Reads everything one claim needs to be judged: counts per period, spend today and last use. */
export async function countUsage({
  client,
  kind,
  now,
  userId,
}: {
  client: TransactionClient;
  kind: UsageKind;
  now: Date;
  userId: string;
}): Promise<UsageCounts> {
  const starts = getUsagePeriodStarts(now);
  const ofKind = { kind, userId };

  const [day, month, total, generatedTotal, spent, last, activeGoals] = await Promise.all([
    client.usageRecord.count({ where: { ...ofKind, createdAt: { gte: starts.day } } }),
    client.usageRecord.count({ where: { ...ofKind, createdAt: { gte: starts.month } } }),
    client.usageRecord.count({ where: ofKind }),
    client.usageRecord.count({ where: { ...ofKind, generated: true } }),
    client.usageRecord.aggregate({
      _sum: { costMicros: true },
      where: { createdAt: { gte: starts.day }, userId },
    }),
    client.usageRecord.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
      where: ofKind,
    }),
    // Quick explanations are goals too, but they don't take one of the plan's active goals.
    kind === "goal"
      ? client.goal.count({ where: { kind: { not: "explain" }, status: "active", userId } })
      : 0,
  ]);

  return {
    activeGoals,
    day,
    generatedTotal,
    lastUsedAt: last?.createdAt ?? null,
    month,
    spentTodayMicros: spent._sum.costMicros ?? 0,
    total,
  };
}
