import { describe, expect, it } from "vitest";
import { formatPlanPrice } from "./plan-price";

describe(formatPlanPrice, () => {
  it.each([
    ["TRY", "₺1,069"],
    ["SEK", "kr\u202F1,069"],
    ["SGD", "$1,069"],
    ["XTS", "XTS\u00A01,069"],
  ])("keeps the %s amount and its currency together", (currency, expected) => {
    expect(formatPlanPrice({ locale: "en", price: { amount: 106_900, currency } })).toBe(expected);
  });
});
