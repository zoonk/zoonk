import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { getAiSpendSince } from "./_utils/ai-spend-since";

/** One row for every UTC day from `start`'s to `end`'s, a day without calls included. */
export const listDailyAiSpendBetween = cacheAdminData(async (start: Date, end: Date) => {
  const rows = await prisma.$queryRaw<{ cost_usd: number | null; day: Date }[]>`
    SELECT days.day, SUM(ai_calls.cost_usd) AS cost_usd
    FROM generate_series(
      date_trunc('day', ${start}::timestamptz AT TIME ZONE 'UTC'),
      date_trunc('day', ${end}::timestamptz AT TIME ZONE 'UTC'),
      interval '1 day'
    ) AS days(day)
    LEFT JOIN ai_calls
      ON ai_calls.created_at >= days.day AND ai_calls.created_at < days.day + interval '1 day'
    GROUP BY days.day
    ORDER BY days.day
  `;

  return rows.map((row) => ({ costUsd: row.cost_usd ?? 0, day: row.day }));
});

export async function listDailyAiSpend(days: number) {
  return listDailyAiSpendBetween(await getAiSpendSince(days), new Date());
}
