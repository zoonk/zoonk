import { type TransactionClient } from "@zoonk/db";
import { FREE_LESSON_LIMIT, FREE_LESSON_WINDOW_MS } from "../limits";

export type LessonStartUsage = { count: number; latest: readonly Date[]; prepared: number };

export const NO_LESSON_STARTS: LessonStartUsage = { count: 0, latest: [], prepared: 0 };

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

  const [counts, latest] = await Promise.all([
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
  ]);

  return {
    count: counts._count.countedAt,
    latest: latest.flatMap((row) => row.countedAt ?? []),
    prepared: counts._count.id - counts._count.countedAt,
  };
}

export function getLessonAvailableAt(usage: LessonStartUsage): Date | null {
  if (usage.count < FREE_LESSON_LIMIT) {
    return null;
  }

  const claim = usage.latest[FREE_LESSON_LIMIT - 1];
  return claim ? new Date(claim.getTime() + FREE_LESSON_WINDOW_MS) : null;
}
