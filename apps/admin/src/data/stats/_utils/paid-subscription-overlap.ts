import { type Sql, sql } from "@zoonk/db";

/**
 * Better Auth overwrites the billing-period start on renewals, but Stripe
 * subscription rows use UUIDv7 and retain their creation time. That is the
 * closest immutable start available without separate lifecycle history; a
 * reused incomplete checkout can still predate its first payment. Legacy
 * manual UUIDs fall back to their stored billing-period start.
 */
function getInferredPaidAccessStartSql(): Sql {
  return sql`COALESCE(
    uuid_extract_timestamp(subscriptions.id),
    subscriptions.period_start
  )`;
}

/**
 * A paid learner belongs to a reporting period when stored paid access overlaps
 * that period. The inferred lifecycle start survives ordinary renewals, while
 * canceled rows require a recorded billing or access end so they cannot count
 * forever. The cancellation-request timestamp is deliberately ignored because
 * access commonly continues until the actual end.
 */
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

/**
 * Trend bars represent the active paid subscriber stock at one bucket end,
 * not everyone who paid at any point inside the bucket. That distinction makes
 * churn visible instead of allowing a canceled learner to inflate later bars.
 */
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
