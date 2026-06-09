import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  trackedAnalyticsUserSql,
  trackedAnalyticsUserWhere,
} from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getConversionRate = cacheAdminData(async () => {
  const [paid, total] = await Promise.all([
    countPaidTrackedUsers(),
    prisma.user.count({ where: trackedAnalyticsUserWhere }),
  ]);

  const rate = total === 0 ? 0 : (paid / total) * 100;

  return { paid, rate, total };
});

/**
 * Conversion rate compares paid users against total users, so duplicate active
 * subscription rows for one user must still count as one paid account.
 */
async function countPaidTrackedUsers() {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT subscriptions.reference_id) AS count
    FROM subscriptions
    JOIN users ON users.id = subscriptions.reference_id
    WHERE
      ${trackedAnalyticsUserSql}
      AND subscriptions.plan != 'free'
      AND subscriptions.status = 'active'
  `;

  return Number(result[0].count);
}
