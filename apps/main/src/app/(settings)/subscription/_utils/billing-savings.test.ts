import { describe, expect, it } from "vitest";
import { getLargestYearlySavings } from "./billing-savings";

describe(getLargestYearlySavings, () => {
  it("returns the largest yearly savings across paid plans", () => {
    const savings = getLargestYearlySavings([
      {
        monthlyPrice: { amount: 1000, currency: "usd" },
        yearlyPrice: { amount: 10_000, currency: "usd" },
      },
      {
        monthlyPrice: { amount: 2000, currency: "usd" },
        yearlyPrice: { amount: 18_000, currency: "usd" },
      },
    ]);

    expect(savings).toStrictEqual({ amount: 6000, currency: "usd" });
  });

  it("ignores plans that cannot prove a same-currency discount", () => {
    const savings = getLargestYearlySavings([
      { monthlyPrice: null, yearlyPrice: null },
      {
        monthlyPrice: { amount: 1000, currency: "usd" },
        yearlyPrice: { amount: 8000, currency: "brl" },
      },
      {
        monthlyPrice: { amount: 1000, currency: "usd" },
        yearlyPrice: { amount: 12_000, currency: "usd" },
      },
    ]);

    expect(savings).toBeNull();
  });

  it("does not compare savings amounts across different currencies", () => {
    const savings = getLargestYearlySavings([
      {
        monthlyPrice: { amount: 5000, currency: "brl" },
        yearlyPrice: { amount: 50_000, currency: "brl" },
      },
      {
        monthlyPrice: { amount: 2000, currency: "usd" },
        yearlyPrice: { amount: 12_000, currency: "usd" },
      },
    ]);

    expect(savings).toStrictEqual({ amount: 10_000, currency: "brl" });
  });
});
