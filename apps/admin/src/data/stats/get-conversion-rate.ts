import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  trackedAnalyticsUserSql,
  trackedAnalyticsUserWhere,
} from "@/data/stats/_utils/analytics-user-filter";
import { getPaidSubscriptionOverlapSql } from "@/data/stats/_utils/paid-subscription-overlap";
import { prisma } from "@zoonk/db";

/** A cumulative denominator, so a subscriber who joined before the month stays in its paid share. */
function getConversionUserWhere(end?: Date) {
  if (!end) {
    return trackedAnalyticsUserWhere;
  }

  return { ...trackedAnalyticsUserWhere, createdAt: { lte: end } };
}

export const getConversionRate = cacheAdminData(async (start?: Date, end?: Date) => {
  const userWhere = getConversionUserWhere(end);

  const [paid, total] = await Promise.all([
    countPaidTrackedUsers({ end, start }),
    prisma.user.count({ where: userWhere }),
  ]);

  const rate = total === 0 ? 0 : (paid / total) * 100;

  return { paid, rate, total };
});

/** Duplicate subscription rows for one learner still count as one paid account. */
async function countPaidTrackedUsers({ start, end }: { start?: Date; end?: Date }) {
  if (start && end) {
    return countPeriodPaidTrackedUsers({ end, start });
  }

  return countCurrentPaidTrackedUsers();
}

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

/** Access intervals, not today's status, so a canceled learner stays in the months they paid. */
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
