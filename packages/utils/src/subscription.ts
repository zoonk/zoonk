const PLAN_NAMES = ["free", "hobby", "plus", "pro"] as const;
type PlanName = (typeof PLAN_NAMES)[number];

export const SUBSCRIPTION_PROVIDERS = ["stripe", "google", "apple", "zoonk"] as const;
export type SubscriptionProvider = (typeof SUBSCRIPTION_PROVIDERS)[number];

const PLAN_LOOKUP_KEYS: Record<Exclude<PlanName, "free">, { monthly: string; yearly: string }> = {
  hobby: { monthly: "hobby_monthly", yearly: "hobby_yearly" },
  plus: { monthly: "plus_monthly", yearly: "plus_yearly" },
  pro: { monthly: "pro_monthly", yearly: "pro_yearly" },
};

type SubscriptionPlan = {
  annualLookupKey: string | null;
  lookupKey: string | null;
  name: PlanName;
  tier: number;
};

type PaidPlan = {
  annualLookupKey: string;
  lookupKey: string;
  name: PlanName;
  tier: number;
};

export const FREE_PLAN: SubscriptionPlan = {
  annualLookupKey: null,
  lookupKey: null,
  name: "free",
  tier: 0,
};

const HIDDEN_PLANS = new Set(
  (process.env.HIDDEN_SUBSCRIPTION_PLANS ?? "").split(",").filter(Boolean),
);

const ALL_PAID_PLANS: readonly PaidPlan[] = [
  {
    annualLookupKey: PLAN_LOOKUP_KEYS.hobby.yearly,
    lookupKey: PLAN_LOOKUP_KEYS.hobby.monthly,
    name: "hobby",
    tier: 1,
  },
  {
    annualLookupKey: PLAN_LOOKUP_KEYS.plus.yearly,
    lookupKey: PLAN_LOOKUP_KEYS.plus.monthly,
    name: "plus",
    tier: 2,
  },
  {
    annualLookupKey: PLAN_LOOKUP_KEYS.pro.yearly,
    lookupKey: PLAN_LOOKUP_KEYS.pro.monthly,
    name: "pro",
    tier: 3,
  },
];

export const PAID_PLANS: readonly PaidPlan[] = ALL_PAID_PLANS.filter(
  (plan) => !HIDDEN_PLANS.has(plan.name),
);

const ALL_SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [FREE_PLAN, ...ALL_PAID_PLANS];
export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [FREE_PLAN, ...PAID_PLANS];

export function getPlanTier(planName: string | null): number {
  if (!planName) {
    return 0;
  }
  return ALL_SUBSCRIPTION_PLANS.find((plan) => plan.name === planName)?.tier ?? 0;
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
