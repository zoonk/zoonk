import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  trackedAnalyticsUserSql,
  trackedAnalyticsUserWhere,
} from "@/data/stats/_utils/analytics-user-filter";
import { getPaidSubscriptionOverlapSql } from "@/data/stats/_utils/paid-subscription-overlap";
import { prisma } from "@zoonk/db";

/**
 * A period ratio includes every tracked learner who existed by its end. This
 * keeps the denominator cumulative so a subscriber who joined before the
 * selected month cannot disappear from that month's paid share.
 */
function getConversionUserWhere(end?: Date) {
  if (!end) {
    return trackedAnalyticsUserWhere;
  }

  return { ...trackedAnalyticsUserWhere, createdAt: { lte: end } };
}

/**
 * Returns the current paid share for the dashboard overview or the share that
 * held paid access during a selected period on the detailed Growth page.
 */
export const getConversionRate = cacheAdminData(async (start?: Date, end?: Date) => {
  const userWhere = getConversionUserWhere(end);

  const [paid, total] = await Promise.all([
    countPaidTrackedUsers({ end, start }),
    prisma.user.count({ where: userWhere }),
  ]);

  const rate = total === 0 ? 0 : (paid / total) * 100;

  return { paid, rate, total };
});

/**
 * Conversion rate compares paid users against total users, so duplicate
 * subscription rows for one learner must still count as one paid account.
 */
async function countPaidTrackedUsers({ start, end }: { start?: Date; end?: Date }) {
  if (start && end) {
    return countPeriodPaidTrackedUsers({ end, start });
  }

  return countCurrentPaidTrackedUsers();
}

/**
 * The overview remains a current-state KPI because it has no selected period.
 */
async function countCurrentPaidTrackedUsers() {
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

/**
 * Historical periods count access intervals rather than today's subscription
 * status, so a canceled learner remains visible in the months they paid.
 */
async function countPeriodPaidTrackedUsers({ start, end }: { start: Date; end: Date }) {
  const overlapSql = getPaidSubscriptionOverlapSql({ periodEnd: end, periodStart: start });

  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT subscriptions.reference_id) AS count
    FROM subscriptions
    JOIN users ON users.id = subscriptions.reference_id
    WHERE
      ${trackedAnalyticsUserSql}
      AND users.created_at <= ${end}
      AND ${overlapSql}
  `;

  return Number(result[0].count);
}
