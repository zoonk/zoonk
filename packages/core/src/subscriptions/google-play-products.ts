import { type StoreSubscriptionSnapshot } from "./reconcile-store-subscription";

export type GooglePlaySubscriptionProduct = Pick<
  StoreSubscriptionSnapshot,
  "billingInterval" | "plan"
>;

/** Play Console subscription products, each with one base plan per billing period. */
const GOOGLE_PLAY_SUBSCRIPTION_PRODUCTS: Record<
  string,
  Record<string, GooglePlaySubscriptionProduct>
> = {
  plus: {
    monthly: { billingInterval: "month", plan: "plus" },
    yearly: { billingInterval: "year", plan: "plus" },
  },
};

/** Rejects valid Play purchases for products Zoonk does not intentionally map to an entitlement. */
export function getGooglePlaySubscriptionProduct({
  basePlanId,
  productId,
}: {
  basePlanId: string | null;
  productId: string;
}) {
  const basePlans = Object.hasOwn(GOOGLE_PLAY_SUBSCRIPTION_PRODUCTS, productId)
    ? GOOGLE_PLAY_SUBSCRIPTION_PRODUCTS[productId]
    : null;

  if (!basePlans || !basePlanId || !Object.hasOwn(basePlans, basePlanId)) {
    return null;
  }

  return basePlans[basePlanId] ?? null;
}
