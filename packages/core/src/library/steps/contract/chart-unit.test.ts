import { describe, expect, it } from "vitest";
import { placeChartUnit } from "./chart-unit";

describe(placeChartUnit, () => {
  it("keeps a short unit after each number", () => {
    expect(placeChartUnit({ unit: "km", valueLabel: "Distance" })).toStrictEqual({
      numberUnit: "km",
      valueLabel: "Distance",
    });
  });

  it("shows a long unit once, beside the value label", () => {
    // The unit cut to "hours per 1," in #2512, now kept whole.
    expect(
      placeChartUnit({ unit: "hours per 1,000 parts", valueLabel: "Processing time" }),
    ).toStrictEqual({ numberUnit: null, valueLabel: "Processing time (hours per 1,000 parts)" });
  });

  it("keeps a long money unit's currency on each number, so its cents still show", () => {
    expect(placeChartUnit({ unit: "USD per response", valueLabel: "Cost" })).toStrictEqual({
      numberUnit: "USD",
      valueLabel: "Cost (per response)",
    });
  });

  it("leaves plain counts without a unit", () => {
    expect(placeChartUnit({ unit: null, valueLabel: "Letters" })).toStrictEqual({
      numberUnit: null,
      valueLabel: "Letters",
    });
  });
});
