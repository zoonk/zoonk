import { type TransactionClient } from "@zoonk/db";
import { FREE_LESSON_LIMIT, FREE_LESSON_WINDOW_MS } from "../limits";

export type LessonStartUsage = { count: number; latest: readonly Date[] };

export async function loadLessonStartUsage({
  client,
  now,
  userId,
}: {
  client: TransactionClient;
  now: Date;
  userId: string;
}): Promise<LessonStartUsage> {
  const where = {
    createdAt: { gt: new Date(now.getTime() - FREE_LESSON_WINDOW_MS), lte: now },
    kind: "lessonStart" as const,
    userId,
  };

  const [count, latest] = await Promise.all([
    client.usageRecord.count({ where }),
    client.usageRecord.findMany({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
      take: FREE_LESSON_LIMIT,
      where,
    }),
  ]);

  return { count, latest: latest.map((claim) => claim.createdAt) };
}

export function getLessonAvailableAt(usage: LessonStartUsage): Date | null {
  if (usage.count < FREE_LESSON_LIMIT) {
    return null;
  }

  const claim = usage.latest[FREE_LESSON_LIMIT - 1];
  return claim ? new Date(claim.getTime() + FREE_LESSON_WINDOW_MS) : null;
}
