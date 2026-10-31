import { MS_PER_DAY } from "./date";

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

const REFUND_DAYS = 14;

/**
 * The day of purchase doesn't count toward the 14 refund days (EU Regulation 1182/71), so the
 * window runs a day past the date the learner is told, which covers the end of that day anywhere.
 */
const REFUND_WINDOW_MS = (REFUND_DAYS + 1) * MS_PER_DAY;

export function getRefundDeadline(subscribedAt: Date): Date {
  return new Date(subscribedAt.getTime() + REFUND_DAYS * MS_PER_DAY);
}

export function isWithinRefundWindow({ now, subscribedAt }: { now: Date; subscribedAt: Date }) {
  return now.getTime() < subscribedAt.getTime() + REFUND_WINDOW_MS;
}
