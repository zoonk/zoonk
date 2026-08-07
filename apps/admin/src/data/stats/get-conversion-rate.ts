import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  trackedAnalyticsUserSql,
  trackedAnalyticsUserWhere,
} from "@/data/stats/_utils/analytics-user-filter";
import { prisma, sql } from "@zoonk/db";

/**
 * Limits the headline to signup cohorts when a stats period is present while
 * keeping the dashboard overview's all-time behavior when dates are omitted.
 */
function getConversionUserWhere({ start, end }: { start?: Date; end?: Date }) {
  if (!start || !end) {
    return trackedAnalyticsUserWhere;
  }

  return { ...trackedAnalyticsUserWhere, createdAt: { gte: start, lte: end } };
}

/**
 * Adds the same optional signup-cohort boundary to the raw subscription count
 * used by the detailed Growth page.
 */
function getConversionDateSql({ start, end }: { start?: Date; end?: Date }) {
  if (!start || !end) {
    return sql``;
  }

  return sql`AND users.created_at >= ${start} AND users.created_at <= ${end}`;
}

/**
 * Returns the active paid share for all tracked users on the overview or for
 * users created inside a selected period on the detailed Growth page.
 */
export const getConversionRate = cacheAdminData(async (start?: Date, end?: Date) => {
  const userWhere = getConversionUserWhere({ end, start });

  const [paid, total] = await Promise.all([
    countPaidTrackedUsers({ end, start }),
    prisma.user.count({ where: userWhere }),
  ]);

  const rate = total === 0 ? 0 : (paid / total) * 100;

  return { paid, rate, total };
});

/**
 * Conversion rate compares paid users against total users, so duplicate active
 * subscription rows for one user must still count as one paid account.
 */
async function countPaidTrackedUsers({ start, end }: { start?: Date; end?: Date }) {
  const dateSql = getConversionDateSql({ end, start });

  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT subscriptions.reference_id) AS count
    FROM subscriptions
    JOIN users ON users.id = subscriptions.reference_id
    WHERE
      ${trackedAnalyticsUserSql}
      AND subscriptions.plan != 'free'
      AND subscriptions.status = 'active'
      ${dateSql}
  `;

  return Number(result[0].count);
}
