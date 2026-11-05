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

type KindUsage = Omit<UsageCounts, "activeGoals" | "spentTodayMicros">;

export type UsageTotals = {
  activeGoals: number;
  kinds: ReadonlyMap<UsageKind, KindUsage>;
  spentTodayMicros: number;
};

const NO_USAGE: KindUsage = {
  day: 0,
  generatedTotal: 0,
  lastUsedAt: null,
  month: 0,
  secondsThisMonth: 0,
  secondsToday: 0,
  total: 0,
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

function getLatest(dates: readonly (Date | null)[]): Date | null {
  return dates.reduce<Date | null>(
    (latest, date) => (date && (!latest || date > latest) ? date : latest),
    null,
  );
}

export async function loadUsageTotals({
  client,
  now,
  userId,
}: {
  client: TransactionClient;
  now: Date;
  userId: string;
}): Promise<UsageTotals> {
  const starts = getUsagePeriodStarts(now);

  const [allTime, thisMonth, today, activeGoals] = await Promise.all([
    client.usageRecord.groupBy({
      _count: { id: true },
      _max: { createdAt: true },
      by: ["kind", "generated"],
      where: { userId },
    }),
    client.usageRecord.groupBy({
      _count: { id: true },
      _sum: { seconds: true },
      by: ["kind"],
      where: { createdAt: { gte: starts.month }, userId },
    }),
    client.usageRecord.groupBy({
      _count: { id: true },
      _sum: { costMicros: true, seconds: true },
      by: ["kind"],
      where: { createdAt: { gte: starts.day }, userId },
    }),
    client.goal.count({ where: { kind: { not: "explain" }, status: "active", userId } }),
  ]);

  const monthOf = new Map(thisMonth.map((group) => [group.kind, group]));
  const dayOf = new Map(today.map((group) => [group.kind, group]));

  const kinds = new Map(
    [...Map.groupBy(allTime, (group) => group.kind)].map(
      ([kind, groups]): [UsageKind, KindUsage] => {
        const month = monthOf.get(kind);
        const day = dayOf.get(kind);

        return [
          kind,
          {
            day: day?._count.id ?? 0,
            generatedTotal: groups
              .filter((group) => group.generated)
              .reduce((sum, group) => sum + group._count.id, 0),
            lastUsedAt: getLatest(groups.map((group) => group._max.createdAt)),
            month: month?._count.id ?? 0,
            secondsThisMonth: month?._sum.seconds ?? 0,
            secondsToday: day?._sum.seconds ?? 0,
            total: groups.reduce((sum, group) => sum + group._count.id, 0),
          },
        ];
      },
    ),
  );

  return {
    activeGoals,
    kinds,
    spentTodayMicros: today.reduce((sum, group) => sum + (group._sum.costMicros ?? 0), 0),
  };
}

export function getUsageCounts(totals: UsageTotals, kind: UsageKind): UsageCounts {
  return {
    ...(totals.kinds.get(kind) ?? NO_USAGE),
    activeGoals: totals.activeGoals,
    spentTodayMicros: totals.spentTodayMicros,
  };
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
  return getUsageCounts(await loadUsageTotals({ client, now, userId }), kind);
}
