import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { getUsagePeriodStarts } from "./usage-periods";

export type UsageCounts = {
  activeGoals: number;
  day: number;
  generatedTotal: number;
  lastUsedAt: Date | null;
  month: number;
  /** Includes held reservations as well as used seconds. */
  secondsThisMonth: number;
  /** Includes held reservations as well as used seconds. */
  secondsToday: number;
  spentTodayMicros: number;
  total: number;
};

/** Counts held reservations as well as used seconds. */
export async function sumCallSeconds({
  client,
  now,
  userId,
}: {
  client: TransactionClient;
  now: Date;
  userId: string;
}): Promise<{ thisMonth: number; today: number }> {
  const starts = getUsagePeriodStarts(now);
  const ofCalls = { kind: "conversation" as const, userId };

  const [today, thisMonth] = await Promise.all([
    client.usageRecord.aggregate({
      _sum: { seconds: true },
      where: { ...ofCalls, createdAt: { gte: starts.day } },
    }),
    client.usageRecord.aggregate({
      _sum: { seconds: true },
      where: { ...ofCalls, createdAt: { gte: starts.month } },
    }),
  ]);

  return { thisMonth: thisMonth._sum.seconds ?? 0, today: today._sum.seconds ?? 0 };
}

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

  const [day, month, total, generatedTotal, spent, kindToday, kindThisMonth, last, activeGoals] =
    await Promise.all([
      client.usageRecord.count({ where: { ...ofKind, createdAt: { gte: starts.day } } }),
      client.usageRecord.count({ where: { ...ofKind, createdAt: { gte: starts.month } } }),
      client.usageRecord.count({ where: ofKind }),
      client.usageRecord.count({ where: { ...ofKind, generated: true } }),
      client.usageRecord.aggregate({
        _sum: { costMicros: true },
        where: { createdAt: { gte: starts.day }, userId },
      }),
      client.usageRecord.aggregate({
        _sum: { seconds: true },
        where: { ...ofKind, createdAt: { gte: starts.day } },
      }),
      client.usageRecord.aggregate({
        _sum: { seconds: true },
        where: { ...ofKind, createdAt: { gte: starts.month } },
      }),
      client.usageRecord.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
        where: ofKind,
      }),
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
    secondsThisMonth: kindThisMonth._sum.seconds ?? 0,
    secondsToday: kindToday._sum.seconds ?? 0,
    spentTodayMicros: spent._sum.costMicros ?? 0,
    total,
  };
}
