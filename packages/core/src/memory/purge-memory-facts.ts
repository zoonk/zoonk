import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

/** How long a deleted or expired fact can still be undone or exported before it's gone for good. */
const PURGE_AFTER_DAYS = 30;

/** Replacement chains are short; this bounds the passes if rows were ever linked by hand. */
const MAX_HISTORY_PASSES = 50;

/**
 * Removes replaced facts whose replacement was just purged. Each pass frees the next older fact of
 * a chain, so passes repeat until none is left.
 */
async function purgeOrphanedHistory(pass = 0): Promise<number> {
  if (pass >= MAX_HISTORY_PASSES) {
    return 0;
  }

  const { count } = await prisma.memoryFact.deleteMany({
    where: { status: "superseded", supersededById: null },
  });

  return count === 0 ? 0 : count + (await purgeOrphanedHistory(pass + 1));
}

/**
 * The scheduled sweep: removes facts deleted more than 30 days ago, and facts that expired more
 * than 30 days ago whatever their status (such as "Has the ENEM on November 8"), together with the
 * older facts they replaced. Returns how many rows were removed, for the job's log.
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

  return { purged: count + (await purgeOrphanedHistory()) };
}
