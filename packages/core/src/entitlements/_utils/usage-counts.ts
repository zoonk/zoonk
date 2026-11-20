import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { getCallExposureMicros } from "../../language/conversations/_utils/live-call-money";
import { FREE_LESSON_LIMIT, USAGE_WINDOW_MS } from "../limits";
import { countActiveGoals } from "./active-goals-left";
import { loadRollingUsage } from "./rolling-usage";
import { getUsagePeriodStarts } from "./usage-periods";

type LessonStartUsage = {
  count: number;
  latest: readonly Date[];
  prepared: number;
  latestPrepared: readonly Date[];
};

export type UsageCounts = {
  callSpend: readonly { at: Date; amount: number }[];
  activeGoals: number;
  lessonStarts: LessonStartUsage;
  day: number;
  generatedTotal: number;
  lastUsedAt: Date | null;
  rollingClaims: readonly { at: Date; amount: number }[];
  usedLast30Days: number;
  /** Includes held reservations as well as used seconds. */
  secondsLast30Days: number;
  /** Includes held reservations as well as used seconds. */
  secondsToday: number;
  spentTodayMicros: number;
  total: number;
};

type KindUsage = Omit<
  UsageCounts,
  "callSpend" | "activeGoals" | "lessonStarts" | "spentTodayMicros"
>;

export type UsageTotals = {
  callSpend: readonly { at: Date; amount: number }[];
  activeGoals: number;
  lessonStarts: LessonStartUsage;
  kinds: ReadonlyMap<UsageKind, KindUsage>;
  spentTodayMicros: number;
};

const NO_USAGE: KindUsage = {
  day: 0,
  generatedTotal: 0,
  lastUsedAt: null,
  rollingClaims: [],
  secondsLast30Days: 0,
  secondsToday: 0,
  total: 0,
  usedLast30Days: 0,
};

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

  const [allTime, rolling, today, activeGoals, connections] = await Promise.all([
    client.usageRecord.groupBy({
      _count: { id: true },
      _max: { createdAt: true },
      by: ["kind", "generated"],
      where: { userId },
    }),
    loadRollingUsage({ client, now, userId }),
    client.usageRecord.groupBy({
      _count: { id: true },
      _sum: { costMicros: true, seconds: true },
      by: ["kind"],
      where: { createdAt: { gte: starts.day }, userId },
    }),
    countActiveGoals({ db: client, userId }),
    client.liveCallConnection.findMany({
      orderBy: { createdAt: "desc" },
      where: { createdAt: { gt: starts.rolling30Days }, userId },
    }),
  ]);

  const dayOf = new Map(today.map((group) => [group.kind, group]));

  const kinds = new Map(
    [...Map.groupBy(allTime, (group) => group.kind)].map(
      ([kind, groups]): [UsageKind, KindUsage] => {
        const window = rolling.get(kind);
        const day = dayOf.get(kind);

        return [
          kind,
          {
            day: day?._count.id ?? 0,
            generatedTotal: groups
              .filter((group) => group.generated)
              .reduce((sum, group) => sum + group._count.id, 0),
            lastUsedAt: getLatest(groups.map((group) => group._max.createdAt)),
            rollingClaims: window?.claims ?? [],
            secondsLast30Days: window?.seconds ?? 0,
            secondsToday: day?._sum.seconds ?? 0,
            total: groups.reduce((sum, group) => sum + group._count.id, 0),
            usedLast30Days: window?.count ?? 0,
          },
        ];
      },
    ),
  );

  return {
    activeGoals,
    callSpend: connections.map((connection) => ({
      amount: getCallExposureMicros({ connection, now }),
      at: connection.createdAt,
    })),
    kinds,
    lessonStarts: {
      count: rolling.get("lessonStart")?.count ?? 0,
      latest: (rolling.get("lessonStart")?.claims ?? []).map((row) => row.at),
      latestPrepared: (rolling.get("lessonPreparation")?.claims ?? []).map((row) => row.at),
      prepared: rolling.get("lessonPreparation")?.count ?? 0,
    },
    spentTodayMicros: today.reduce((sum, group) => sum + (group._sum.costMicros ?? 0), 0),
  };
}

export function getUsageCounts(totals: UsageTotals, kind: UsageKind): UsageCounts {
  return {
    ...(totals.kinds.get(kind) ?? NO_USAGE),
    activeGoals: totals.activeGoals,
    callSpend: totals.callSpend,
    lessonStarts: totals.lessonStarts,
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

/** The totals once one more use is recorded now. */
export function addUsage({
  costMicros,
  generated,
  kind,
  now,
  totals,
}: {
  costMicros: number;
  generated: boolean;
  kind: UsageKind;
  now: Date;
  totals: UsageTotals;
}): UsageTotals {
  const used = totals.kinds.get(kind) ?? NO_USAGE;

  return {
    ...totals,
    kinds: new Map([
      ...totals.kinds,
      [
        kind,
        {
          ...used,
          day: used.day + 1,
          generatedTotal: used.generatedTotal + (generated ? 1 : 0),
          lastUsedAt: now,
          rollingClaims: [{ amount: 1, at: now }, ...used.rollingClaims],
          total: used.total + 1,
          usedLast30Days: used.usedLast30Days + 1,
        },
      ],
    ]),
    lessonStarts:
      kind === "lessonStart"
        ? {
            ...totals.lessonStarts,
            count: totals.lessonStarts.count + 1,
            latest: [now, ...totals.lessonStarts.latest]
              .toSorted((a, b) => b.getTime() - a.getTime())
              .slice(0, FREE_LESSON_LIMIT),
          }
        : totals.lessonStarts,
    spentTodayMicros: totals.spentTodayMicros + costMicros,
  };
}

export function promotePreparedUsage({
  now,
  preparedAt,
  totals,
}: {
  now: Date;
  preparedAt: Date;
  totals: UsageTotals;
}): UsageTotals {
  const usage = totals.lessonStarts;
  const inWindow = preparedAt.getTime() > now.getTime() - USAGE_WINDOW_MS;

  return {
    ...totals,
    lessonStarts: {
      ...usage,
      count: usage.count + 1,
      latest: [now, ...usage.latest]
        .toSorted((a, b) => b.getTime() - a.getTime())
        .slice(0, FREE_LESSON_LIMIT),
      latestPrepared: usage.latestPrepared.filter(
        (_, index) =>
          index !==
          usage.latestPrepared.findIndex((date) => date.getTime() === preparedAt.getTime()),
      ),
      prepared: Math.max(0, usage.prepared - Number(inWindow)),
    },
  };
}
