import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Records when tasks last read these facts, so stale ones can be reviewed. A raw update keeps
 * `updated_at` for changes to the fact itself; Prisma would move it on every read.
 */
export async function markMemoryFactsUsed({
  ids,
  now,
  userId,
}: {
  ids: readonly string[];
  now: Date;
  userId: string;
}): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await prisma.$executeRaw`
    UPDATE memory_facts SET last_used_at = ${now}
    WHERE user_id = ${userId}::uuid AND id::text = ANY(${[...ids]}::text[])`;
}
