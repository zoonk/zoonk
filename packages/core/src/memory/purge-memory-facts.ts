import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

const PURGE_AFTER_DAYS = 30;

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
