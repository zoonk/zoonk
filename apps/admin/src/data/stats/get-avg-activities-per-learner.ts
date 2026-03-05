import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getAvgActivitiesPerLearner = cache(async () => {
  const result = await prisma.$queryRaw<[{ total: bigint; learners: bigint }]>`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT user_id) as learners
    FROM activity_progress
    WHERE completed_at IS NOT NULL
  `;

  const total = Number(result[0].total);
  const learners = Number(result[0].learners);

  return learners === 0 ? 0 : Math.round((total / learners) * 10) / 10;
});
