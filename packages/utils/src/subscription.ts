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

/**
 * Admin plan changes use the same Free and Plus source of truth as checkout so
 * a crafted form submission cannot create an unsupported subscription plan.
 */
export function isSubscriptionPlanName(plan: string): plan is SubscriptionPlanName {
  return SUBSCRIPTION_PLANS.some((subscriptionPlan) => subscriptionPlan.name === plan);
}

/**
 * The web billing page should only expose direct plan controls when Stripe owns
 * the subscription. Every other provider needs a different handoff.
 */
export function isWebManagedSubscriptionProvider(
  provider?: SubscriptionProvider | null,
): provider is "stripe" {
  return provider === "stripe";
}

/**
 * Apple and Google purchases must be managed in the original store instead of
 * pretending the web app can cancel or change them.
 */
export function isStoreSubscriptionProvider(
  provider?: SubscriptionProvider | null,
): provider is "apple" | "google" {
  return provider === "apple" || provider === "google";
}
