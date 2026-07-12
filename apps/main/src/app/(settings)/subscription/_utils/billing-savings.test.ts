import { describe, expect, it } from "vitest";
import { getYearlySavings } from "./billing-savings";

describe(getYearlySavings, () => {
  it("returns the proven yearly savings for Plus", () => {
    const savings = getYearlySavings({
      monthlyPrice: { amount: 2000, currency: "usd" },
      yearlyPrice: { amount: 18_000, currency: "usd" },
    });

    expect(savings).toStrictEqual({ amount: 6000, currency: "usd" });
  });

  it("returns null when either price is missing", () => {
    const savings = getYearlySavings({ monthlyPrice: null, yearlyPrice: null });

    expect(savings).toBeNull();
  });

  it("does not compare prices in different currencies", () => {
    const savings = getYearlySavings({
      monthlyPrice: { amount: 1000, currency: "usd" },
      yearlyPrice: { amount: 8000, currency: "brl" },
    });

    expect(savings).toBeNull();
  });

  it("does not claim savings when yearly billing is not cheaper", () => {
    const savings = getYearlySavings({
      monthlyPrice: { amount: 1000, currency: "usd" },
      yearlyPrice: { amount: 12_000, currency: "usd" },
    });

    expect(savings).toBeNull();
  });
});
