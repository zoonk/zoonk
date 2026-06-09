import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const countSubscribersByPlan = cacheAdminData(async () => {
  const results = await prisma.$queryRaw<{ count: bigint; plan: string }[]>`
    SELECT subscriptions.plan, COUNT(*) AS count
    FROM subscriptions
    JOIN users ON users.id = subscriptions.reference_id
    WHERE ${trackedAnalyticsUserSql} AND subscriptions.status = 'active'
    GROUP BY subscriptions.plan
    ORDER BY subscriptions.plan ASC
  `;

  return results.map((row) => ({ count: Number(row.count), plan: row.plan }));
});
