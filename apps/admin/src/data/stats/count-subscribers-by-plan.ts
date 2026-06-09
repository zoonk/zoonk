import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const countSubscribersByPlan = cacheAdminData(async () => {
  const results = await prisma.$queryRaw<{ count: bigint; plan: string }[]>`
    WITH current_subscriptions AS (
      SELECT
        subscriptions.plan,
        ROW_NUMBER() OVER (
          PARTITION BY subscriptions.reference_id
          ORDER BY
            COALESCE(subscriptions.period_start, subscriptions.period_end) DESC NULLS LAST,
            subscriptions.id DESC
        ) AS subscription_rank
      FROM subscriptions
      JOIN users ON users.id = subscriptions.reference_id
      WHERE ${trackedAnalyticsUserSql} AND subscriptions.status = 'active'
    )
    SELECT plan, COUNT(*) AS count
    FROM current_subscriptions
    WHERE subscription_rank = 1
    GROUP BY plan
    ORDER BY plan ASC
  `;

  return results.map((row) => ({ count: Number(row.count), plan: row.plan }));
});
