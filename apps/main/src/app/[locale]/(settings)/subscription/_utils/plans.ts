export const SUBSCRIPTION_PLANS = [
  { annualLookupKey: null, lookupKey: null, name: "free", tier: 0 },
  { annualLookupKey: "hobby_yearly", lookupKey: "hobby_monthly", name: "hobby", tier: 1 },
  { annualLookupKey: "plus_yearly", lookupKey: "plus_monthly", name: "plus", tier: 2 },
  { annualLookupKey: "pro_yearly", lookupKey: "pro_monthly", name: "pro", tier: 3 },
] as const;

export function getPlanTier(planName: string | null): number {
  if (!planName) {
    return 0;
  }
  return SUBSCRIPTION_PLANS.find((plan) => plan.name === planName)?.tier ?? 0;
}
