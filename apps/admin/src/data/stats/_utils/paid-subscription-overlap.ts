import { type Sql, sql } from "@zoonk/db";

/**
 * Better Auth overwrites the billing-period start on renewals, but Stripe rows use UUIDv7 and keep
 * their creation time. Legacy manual UUIDs fall back to their stored billing-period start.
 */
function getInferredPaidAccessStartSql(): Sql {
  return sql`COALESCE(
    uuid_extract_timestamp(subscriptions.id),
    subscriptions.period_start
  )`;
}

/** The cancellation-request time is ignored: access commonly continues until the actual end. */
export function getPaidSubscriptionOverlapSql({
  periodEnd,
  periodStart,
}: {
  periodEnd: Date | Sql;
  periodStart: Date | Sql;
}): Sql {
  const paidAccessStartSql = getInferredPaidAccessStartSql();

  return sql`
    subscriptions.plan != 'free'
    AND ${paidAccessStartSql} <= ${periodEnd}
    AND (
      (
        subscriptions.status = 'active'
        AND COALESCE(
          subscriptions.ended_at,
          subscriptions.period_end,
          'infinity'::timestamp
        ) >= ${periodStart}
      )
      OR (
        subscriptions.status = 'canceled'
        AND COALESCE(subscriptions.ended_at, subscriptions.period_end) >= ${periodStart}
      )
    )
  `;
}

export function getActivePaidSubscriptionAtSql({ pointInTime }: { pointInTime: Date | Sql }): Sql {
  const paidAccessStartSql = getInferredPaidAccessStartSql();

  return sql`
    subscriptions.plan != 'free'
    AND ${paidAccessStartSql} <= ${pointInTime}
    AND (
      (
        subscriptions.status = 'active'
        AND COALESCE(subscriptions.ended_at, 'infinity'::timestamp) > ${pointInTime}
      )
      OR (
        subscriptions.status = 'canceled'
        AND COALESCE(subscriptions.ended_at, subscriptions.period_end) > ${pointInTime}
      )
    )
  `;
}
