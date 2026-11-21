import { describe, expect, it } from "vitest";
import { placeChartUnit } from "./chart-unit";

describe(placeChartUnit, () => {
  it("shows a unit once, beside the value label, and not on each number", () => {
    expect(placeChartUnit({ unit: "km", valueLabel: "Distance" })).toStrictEqual({
      currency: null,
      valueLabel: "Distance (km)",
    });

    expect(
      placeChartUnit({ unit: "hours per 1,000 parts", valueLabel: "Processing time" }),
    ).toStrictEqual({ currency: null, valueLabel: "Processing time (hours per 1,000 parts)" });
  });

  it("keeps a currency on each number, so its cents still show", () => {
    expect(placeChartUnit({ unit: "R$", valueLabel: "Price" })).toStrictEqual({
      currency: "BRL",
      valueLabel: "Price",
    });
  });

  it("shows the rest of a money unit beside the value label", () => {
    expect(placeChartUnit({ unit: "USD per response", valueLabel: "Cost" })).toStrictEqual({
      currency: "USD",
      valueLabel: "Cost (per response)",
    });

    expect(placeChartUnit({ unit: "R$ per hour", valueLabel: "Pay" })).toStrictEqual({
      currency: "BRL",
      valueLabel: "Pay (per hour)",
    });
  });

  it("leaves plain counts without a unit", () => {
    expect(placeChartUnit({ unit: null, valueLabel: "Letters" })).toStrictEqual({
      currency: null,
      valueLabel: "Letters",
    });
  });
});
