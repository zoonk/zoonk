import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  trackedAnalyticsUserSql,
  trackedAnalyticsUserWhere,
} from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getConversionRate = cacheAdminData(async () => {
  const [paid, total] = await Promise.all([
    countPaidTrackedSubscriptions(),
    prisma.user.count({ where: trackedAnalyticsUserWhere }),
  ]);

  const rate = total === 0 ? 0 : (paid / total) * 100;

  return { paid, rate, total };
});

/**
 * Subscription rows store the owning user id as Better Auth's `reference_id`,
 * so raw SQL is the simplest way to apply the user analytics exclusion without
 * introducing a duplicate Prisma relation just for admin reporting.
 */
async function countPaidTrackedSubscriptions() {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM subscriptions
    JOIN users ON users.id = subscriptions.reference_id
    WHERE
      ${trackedAnalyticsUserSql}
      AND subscriptions.plan != 'free'
      AND subscriptions.status = 'active'
  `;

  return Number(result[0].count);
}
