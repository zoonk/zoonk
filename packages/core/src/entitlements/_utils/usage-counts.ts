import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { type EntitlementTier } from "../contract";
import { FREE_LESSON_LIMIT, FREE_LESSON_WINDOW_MS } from "../limits";
import { countActiveGoals } from "./active-goals-left";
import {
  type LessonStartUsage,
  NO_LESSON_STARTS,
  loadLessonStartUsage,
} from "./lesson-start-usage";
import { getUsagePeriodStarts } from "./usage-periods";

export type UsageCounts = {
  activeGoals: number;
  lessonStarts: LessonStartUsage;
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

type KindUsage = Omit<UsageCounts, "activeGoals" | "lessonStarts" | "spentTodayMicros">;

export type UsageTotals = {
  activeGoals: number;
  lessonStarts: LessonStartUsage;
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
  includeLessonStarts = true,
  client,
  now,
  userId,
}: {
  client: TransactionClient;
  now: Date;
  userId: string;
  includeLessonStarts?: boolean;
}): Promise<UsageTotals> {
  const starts = getUsagePeriodStarts(now);

  const [allTime, thisMonth, today, activeGoals, lessonStarts] = await Promise.all([
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
    countActiveGoals({ db: client, userId }),
    includeLessonStarts ? loadLessonStartUsage({ client, now, userId }) : NO_LESSON_STARTS,
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
    lessonStarts,
    spentTodayMicros: today.reduce((sum, group) => sum + (group._sum.costMicros ?? 0), 0),
  };
}

export function getUsageCounts(totals: UsageTotals, kind: UsageKind): UsageCounts {
  return {
    ...(totals.kinds.get(kind) ?? NO_USAGE),
    activeGoals: totals.activeGoals,
    lessonStarts: totals.lessonStarts,
    spentTodayMicros: totals.spentTodayMicros,
  };
}

export async function countUsage({
  tier,
  client,
  kind,
  now,
  userId,
}: {
  client: TransactionClient;
  kind: UsageKind;
  now: Date;
  userId: string;
  tier?: EntitlementTier;
}): Promise<UsageCounts> {
  return getUsageCounts(
    await loadUsageTotals({
      client,
      includeLessonStarts: kind === "lessonStart" && (!tier || tier === "free"),
      now,
      userId,
    }),
    kind,
  );
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
          month: used.month + 1,
          total: used.total + 1,
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
  const inWindow = preparedAt.getTime() > now.getTime() - FREE_LESSON_WINDOW_MS;

  return {
    ...totals,
    lessonStarts: {
      ...usage,
      count: usage.count + 1,
      latest: [now, ...usage.latest]
        .toSorted((a, b) => b.getTime() - a.getTime())
        .slice(0, FREE_LESSON_LIMIT),
      prepared: Math.max(0, usage.prepared - Number(inWindow)),
    },
  };
}
