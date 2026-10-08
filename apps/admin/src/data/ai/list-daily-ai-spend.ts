import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { getAiSpendSince } from "./_utils/ai-spend-since";

/** What AI calls cost per UTC day of the period, including the days with no calls. */
export const listDailyAiSpend = cacheAdminData(async (days: number) => {
  const since = await getAiSpendSince(days);

  const rows = await prisma.$queryRaw<{ cost_usd: number | null; day: Date }[]>`
    SELECT days.day, SUM(ai_calls.cost_usd) AS cost_usd
    FROM generate_series(
      date_trunc('day', ${since}::timestamptz AT TIME ZONE 'UTC'),
      date_trunc('day', now() AT TIME ZONE 'UTC'),
      interval '1 day'
    ) AS days(day)
    LEFT JOIN ai_calls
      ON ai_calls.created_at >= days.day AND ai_calls.created_at < days.day + interval '1 day'
    GROUP BY days.day
    ORDER BY days.day
  `;

  return rows.map((row) => ({ costUsd: row.cost_usd ?? 0, day: row.day }));
});
