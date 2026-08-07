import { type Sql, sql } from "@zoonk/db";

/**
 * A paid learner belongs to a reporting period when stored paid access overlaps
 * that period. Active rows without an end remain open; canceled rows require a
 * recorded billing or access end so they cannot count indefinitely after churn.
 * The cancellation-request timestamp is deliberately ignored because access
 * commonly continues until the billing period ends.
 */
export function getPaidSubscriptionOverlapSql({
  periodEnd,
  periodStart,
}: {
  periodEnd: Date | Sql;
  periodStart: Date | Sql;
}): Sql {
  return sql`
    subscriptions.plan != 'free'
    AND subscriptions.period_start IS NOT NULL
    AND subscriptions.period_start <= ${periodEnd}
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
