import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

/** Retain expired codes so returning learners hear that their code expired rather than that it is wrong. */
const EXPIRED_VERIFICATION_RETENTION_DAYS = 1;

export async function purgeExpiredVerifications(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - EXPIRED_VERIFICATION_RETENTION_DAYS * MS_PER_DAY);
  const { count } = await prisma.verification.deleteMany({ where: { expiresAt: { lt: cutoff } } });

  return { purged: count };
}
