import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

/** How long a deleted or expired fact can still be undone or exported before it's gone for good. */
const PURGE_AFTER_DAYS = 30;

/**
 * The scheduled sweep: removes facts deleted more than 30 days ago, and facts that expired more
 * than 30 days ago whatever their status (such as "Has the ENEM on November 8"). The database
 * removes the older facts they replaced with them. Returns how many facts the sweep matched, for
 * the job's log.
 */
export async function purgeMemoryFacts({ now = new Date() }: { now?: Date } = {}): Promise<{
  purged: number;
}> {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * MS_PER_DAY);

  const { count } = await prisma.memoryFact.deleteMany({
    where: {
      OR: [{ deletedAt: { lt: cutoff }, status: "deleted" }, { expiresAt: { lt: cutoff } }],
    },
  });

  return { purged: count };
}
