type ActiveSubscriptionCandidate = {
  periodEnd?: Date | null;
  periodStart?: Date | null;
  status?: string | null;
};

/** Ids don't reflect recency, so rows sort by billing period start. */
export function findUserActiveSubscription<T extends ActiveSubscriptionCandidate>(
  subscriptions: T[],
): T | null {
  const sortedSubscriptions = subscriptions.toSorted(compareSubscriptionsByStartDate);
  return sortedSubscriptions.find((subscription) => isActiveSubscription(subscription)) ?? null;
}

function compareSubscriptionsByStartDate<T extends ActiveSubscriptionCandidate>(a: T, b: T) {
  return getSubscriptionStartTime(b) - getSubscriptionStartTime(a);
}

/** Manual and older rows can miss billing dates, so those sort behind real periods. */
function getSubscriptionStartTime<T extends ActiveSubscriptionCandidate>(subscription: T) {
  return subscription.periodStart?.getTime() ?? subscription.periodEnd?.getTime() ?? 0;
}

function isActiveSubscription<T extends ActiveSubscriptionCandidate>(subscription: T) {
  return subscription.status === "active" || subscription.status === "trialing";
}
