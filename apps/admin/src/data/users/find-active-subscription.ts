type ActiveSubscriptionCandidate = {
  periodEnd?: Date | null;
  periodStart?: Date | null;
  status?: string | null;
};

/**
 * Admin views need the currently active subscription for a user, not the row
 * with the lexicographically largest identifier. After auth IDs switched to
 * UUIDs, ordering by `id` stopped reflecting recency, so we sort by the billing
 * period start and then reuse the shared Better Auth status rule.
 */
export function findUserActiveSubscription<T extends ActiveSubscriptionCandidate>(
  subscriptions: T[],
): T | null {
  const sortedSubscriptions = subscriptions.toSorted(compareSubscriptionsByStartDate);
  return sortedSubscriptions.find((subscription) => isActiveSubscription(subscription)) ?? null;
}

/**
 * If a user somehow has multiple active or trialing rows, the most recent
 * billing cycle is the safest one to treat as current in the admin UI.
 */
function compareSubscriptionsByStartDate<T extends ActiveSubscriptionCandidate>(a: T, b: T) {
  return getSubscriptionStartTime(b) - getSubscriptionStartTime(a);
}

/**
 * Manual rows and older records can miss billing dates, so missing values fall
 * behind real subscription periods instead of winning the sort accidentally.
 */
function getSubscriptionStartTime<T extends ActiveSubscriptionCandidate>(subscription: T) {
  return subscription.periodStart?.getTime() ?? subscription.periodEnd?.getTime() ?? 0;
}

/**
 * Better Auth treats active and trialing subscriptions as the rows that still
 * grant access, which is exactly the row the admin UI needs to read or update.
 */
function isActiveSubscription<T extends ActiveSubscriptionCandidate>(subscription: T) {
  return subscription.status === "active" || subscription.status === "trialing";
}
