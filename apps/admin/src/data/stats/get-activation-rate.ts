import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getActivationRate = cacheAdminData(async () => {
  const [activatedResult, total] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM lesson_progress
      WHERE completed_at IS NOT NULL
    `,
    prisma.user.count(),
  ]);

  const activated = Number(activatedResult[0].count);
  const rate = total === 0 ? 0 : (activated / total) * 100;

  return { activated, rate, total };
});
