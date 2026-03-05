import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getPeriodActiveLearners = cache(async (start: Date, end: Date) => {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT user_id) as count
    FROM daily_progress
    WHERE date >= ${start} AND date <= ${end}
  `;

  return Number(result[0].count);
});
