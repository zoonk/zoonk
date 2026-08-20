export type AppleSubscriptionProduct = { billingInterval: "month" | "year"; plan: "plus" };

const APPLE_SUBSCRIPTION_PRODUCTS: Record<string, AppleSubscriptionProduct> = {
  "com.zoonk.plus.monthly": { billingInterval: "month", plan: "plus" },
  "com.zoonk.plus.yearly": { billingInterval: "year", plan: "plus" },
};

/** Rejects valid Apple transactions for products Zoonk does not intentionally map to an entitlement. */
export function getAppleSubscriptionProduct(productId: string) {
  return Object.hasOwn(APPLE_SUBSCRIPTION_PRODUCTS, productId)
    ? APPLE_SUBSCRIPTION_PRODUCTS[productId]
    : null;
}
