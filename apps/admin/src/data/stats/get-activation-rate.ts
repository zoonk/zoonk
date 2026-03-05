import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getActivationRate = cache(async () => {
  const [activatedResult, total] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM activity_progress
      WHERE completed_at IS NOT NULL
    `,
    prisma.user.count(),
  ]);

  const activated = Number(activatedResult[0].count);
  const rate = total === 0 ? 0 : (activated / total) * 100;

  return { activated, rate, total };
});
