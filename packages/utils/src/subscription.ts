export const PLAN_NAMES = ["free", "hobby", "plus", "pro"] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

const PLAN_LOOKUP_KEYS: Record<Exclude<PlanName, "free">, { monthly: string; yearly: string }> = {
  hobby: { monthly: "hobby_monthly", yearly: "hobby_yearly" },
  plus: { monthly: "plus_monthly", yearly: "plus_yearly" },
  pro: { monthly: "pro_monthly", yearly: "pro_yearly" },
};

export type SubscriptionPlan = {
  annualLookupKey: string | null;
  lookupKey: string | null;
  name: PlanName;
  tier: number;
};

export type PaidPlan = {
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

export const PAID_PLANS: readonly PaidPlan[] = [
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

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [FREE_PLAN, ...PAID_PLANS];

export function getPlanTier(planName: string | null): number {
  if (!planName) {
    return 0;
  }
  return SUBSCRIPTION_PLANS.find((plan) => plan.name === planName)?.tier ?? 0;
}
