import { describe, expect, it } from "vitest";
import { placeChartUnit } from "./chart-unit";

describe(placeChartUnit, () => {
  it("shows a unit once, beside the axis label, and not on each number", () => {
    expect(placeChartUnit({ label: "Distance", unit: "km" })).toStrictEqual({
      label: "Distance (km)",
      numberUnit: null,
    });

    expect(
      placeChartUnit({ label: "Processing time", unit: "hours per 1,000 parts" }),
    ).toStrictEqual({ label: "Processing time (hours per 1,000 parts)", numberUnit: null });
  });

  it("keeps a currency on each number, so its cents still show", () => {
    expect(placeChartUnit({ label: "Price", unit: "R$" })).toStrictEqual({
      label: "Price",
      numberUnit: "BRL",
    });
  });

  it("keeps a sign written against the digits on each number", () => {
    expect(placeChartUnit({ label: "Fill rate", unit: "%" })).toStrictEqual({
      label: "Fill rate",
      numberUnit: "%",
    });
  });

  it("shows the rest of a money unit beside the axis label", () => {
    expect(placeChartUnit({ label: "Cost", unit: "USD per response" })).toStrictEqual({
      label: "Cost (per response)",
      numberUnit: "USD",
    });

    expect(placeChartUnit({ label: "Pay", unit: "R$ per hour" })).toStrictEqual({
      label: "Pay (per hour)",
      numberUnit: "BRL",
    });
  });

  it("leaves plain counts without a unit", () => {
    expect(placeChartUnit({ label: "Letters", unit: null })).toStrictEqual({
      label: "Letters",
      numberUnit: null,
    });
  });
});
