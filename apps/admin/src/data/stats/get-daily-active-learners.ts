import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getDailyActiveLearners = cache(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT date, COUNT(DISTINCT user_id) as count
    FROM daily_progress
    WHERE date >= ${start} AND date <= ${end}
    GROUP BY date
    ORDER BY date ASC
  `;

  return results.map((row) => ({
    count: Number(row.count),
    date: row.date,
  }));
});
