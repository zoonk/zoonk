import { describe, expect, it } from "vitest";
import { getMonthlyEquivalent, getYearlyPriceComparison } from "./billing-prices";

describe(getMonthlyEquivalent, () => {
  it("returns the yearly price divided across twelve months", () => {
    const monthlyEquivalent = getMonthlyEquivalent({
      yearlyPrice: { amount: 18_000, currency: "usd" },
    });

    expect(monthlyEquivalent).toStrictEqual({ amount: 1500, currency: "usd" });
  });

  it("rounds the equivalent to the nearest minor currency unit", () => {
    const monthlyEquivalent = getMonthlyEquivalent({
      yearlyPrice: { amount: 9999, currency: "usd" },
    });

    expect(monthlyEquivalent).toStrictEqual({ amount: 833, currency: "usd" });
  });

  it("returns null when the yearly price is missing", () => {
    expect(getMonthlyEquivalent({ yearlyPrice: null })).toBeNull();
  });
});

describe(getYearlyPriceComparison, () => {
  it("returns the monthly total, yearly price, and proven savings", () => {
    const comparison = getYearlyPriceComparison({
      monthlyPrice: { amount: 2000, currency: "usd" },
      yearlyPrice: { amount: 18_000, currency: "usd" },
    });

    expect(comparison).toStrictEqual({
      discountedPrice: { amount: 18_000, currency: "usd" },
      originalPrice: { amount: 24_000, currency: "usd" },
      savings: { amount: 6000, currency: "usd" },
    });
  });

  it("returns null when either price is missing", () => {
    const comparison = getYearlyPriceComparison({ monthlyPrice: null, yearlyPrice: null });

    expect(comparison).toBeNull();
  });

  it("does not compare prices in different currencies", () => {
    const comparison = getYearlyPriceComparison({
      monthlyPrice: { amount: 1000, currency: "usd" },
      yearlyPrice: { amount: 8000, currency: "brl" },
    });

    expect(comparison).toBeNull();
  });

  it("does not claim savings when yearly billing is not cheaper", () => {
    const comparison = getYearlyPriceComparison({
      monthlyPrice: { amount: 1000, currency: "usd" },
      yearlyPrice: { amount: 12_000, currency: "usd" },
    });

    expect(comparison).toBeNull();
  });
});
