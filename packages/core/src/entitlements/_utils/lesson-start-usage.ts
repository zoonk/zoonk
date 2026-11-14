import { type TransactionClient } from "@zoonk/db";
import { FREE_LESSON_LIMIT, FREE_LESSON_WINDOW_MS } from "../limits";

export type LessonStartUsage = {
  count: number;
  latest: readonly Date[];
  prepared: number;
  latestPrepared: readonly Date[];
};

export const NO_LESSON_STARTS: LessonStartUsage = {
  count: 0,
  latest: [],
  latestPrepared: [],
  prepared: 0,
};

export async function loadLessonStartUsage({
  client,
  now,
  userId,
}: {
  client: TransactionClient;
  now: Date;
  userId: string;
}): Promise<LessonStartUsage> {
  const cutoff = new Date(now.getTime() - FREE_LESSON_WINDOW_MS);
  const identity = { kind: "lessonStart" as const, userId };
  const pending = { ...identity, countedAt: null, createdAt: { gt: cutoff } };

  const [counts, latest, prepared] = await Promise.all([
    client.usageRecord.aggregate({
      _count: { countedAt: true, id: true },
      where: {
        ...identity,
        OR: [{ countedAt: { gt: cutoff } }, { countedAt: null, createdAt: { gt: cutoff } }],
      },
    }),
    client.usageRecord.findMany({
      orderBy: { countedAt: "desc" },
      select: { countedAt: true },
      take: FREE_LESSON_LIMIT,
      where: { ...identity, countedAt: { gt: cutoff } },
    }),
    client.usageRecord.findMany({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
      take: FREE_LESSON_LIMIT,
      where: pending,
    }),
  ]);

  return {
    count: counts._count.countedAt,
    latest: latest.flatMap((row) => row.countedAt ?? []),
    latestPrepared: prepared.map((row) => row.createdAt),
    prepared: counts._count.id - counts._count.countedAt,
  };
}

export function getLessonAvailableAt(usage: LessonStartUsage, preparing = false): Date | null {
  const count = usage.count + (preparing ? usage.prepared : 0);

  if (count < FREE_LESSON_LIMIT) {
    return null;
  }

  const dates = preparing
    ? [...usage.latest, ...usage.latestPrepared].toSorted((a, b) => b.getTime() - a.getTime())
    : usage.latest;

  const claim = dates[FREE_LESSON_LIMIT - 1];
  return claim ? new Date(claim.getTime() + FREE_LESSON_WINDOW_MS) : null;
}
