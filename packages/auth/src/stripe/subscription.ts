type SubscriptionStatus = { status?: string | null };

function isActiveSubscription<T extends SubscriptionStatus>(sub: T): boolean {
  return sub.status === "active" || sub.status === "trialing";
}

export function findActiveSubscription<T extends SubscriptionStatus>(
  subscriptions: T[] | null | undefined,
): T | undefined {
  return subscriptions?.find((sub) => isActiveSubscription(sub));
}
