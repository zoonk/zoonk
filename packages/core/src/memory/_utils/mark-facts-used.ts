import "server-only";
import { prisma } from "@zoonk/db";

/** Raw SQL, since Prisma's `@updatedAt` would move `updated_at` on every read. */
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
