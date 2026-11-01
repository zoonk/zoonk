const SUBSCRIPTION_PROVIDERS = ["stripe", "google", "apple", "zoonk"] as const;
export type SubscriptionProvider = (typeof SUBSCRIPTION_PROVIDERS)[number];

const FREE_PLAN = { annualLookupKey: null, lookupKey: null, name: "free" } as const;

export const PLUS_PLAN = {
  annualLookupKey: "plus_yearly",
  lookupKey: "plus_monthly",
  name: "plus",
} as const;

export const PAID_PLANS = [PLUS_PLAN] as const;
export const SUBSCRIPTION_PLANS = [FREE_PLAN, ...PAID_PLANS] as const;
export type SubscriptionPlanName = (typeof SUBSCRIPTION_PLANS)[number]["name"];

export function isSubscriptionPlanName(plan: string): plan is SubscriptionPlanName {
  return SUBSCRIPTION_PLANS.some((subscriptionPlan) => subscriptionPlan.name === plan);
}

export function isWebManagedSubscriptionProvider(
  provider?: SubscriptionProvider | null,
): provider is "stripe" {
  return provider === "stripe";
}
