import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

/**
 * How long a sign-in code (or another auth verification) is kept after it expires: long enough
 * that a learner who comes back with an old code hears it expired, not that it's wrong.
 */
const EXPIRED_VERIFICATION_RETENTION_DAYS = 1;

/**
 * The scheduled sweep: removes auth verifications that expired more than a day ago, which Better
 * Auth no longer deletes on every sign-in. Returns how many rows were removed, for the job's log.
 */
export async function purgeExpiredVerifications(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - EXPIRED_VERIFICATION_RETENTION_DAYS * MS_PER_DAY);
  const { count } = await prisma.verification.deleteMany({ where: { expiresAt: { lt: cutoff } } });

  return { purged: count };
}
