import { describe, expect, it } from "vitest";
import { getAppleSubscriptionProduct } from "./apple-products";

describe(getAppleSubscriptionProduct, () => {
  it.each(["constructor", "toString", "__proto__"])(
    "rejects the inherited object key %s as an unsupported product",
    (productId) => {
      expect(getAppleSubscriptionProduct(productId)).toBeNull();
    },
  );
});
