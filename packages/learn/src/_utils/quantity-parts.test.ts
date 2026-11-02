import { describe, expect, it } from "vitest";
import { splitQuantity } from "./quantity-parts";

describe(splitQuantity, () => {
  it("keeps an approximate number whole and its unit apart", () => {
    expect(splitQuantity("~2 h")).toStrictEqual([
      { numeric: true, text: "~2" },
      { numeric: false, text: " h" },
    ]);
  });

  it("splits hours and minutes into each number and unit", () => {
    expect(splitQuantity("1 h 30 min")).toStrictEqual([
      { numeric: true, text: "1" },
      { numeric: false, text: " h " },
      { numeric: true, text: "30" },
      { numeric: false, text: " min" },
    ]);
  });

  it("leaves a bare number as one part", () => {
    expect(splitQuantity("~16")).toStrictEqual([{ numeric: true, text: "~16" }]);
  });

  it("keeps decimals and narrow no-break spaces", () => {
    expect(splitQuantity("1,5 h")).toStrictEqual([
      { numeric: true, text: "1,5" },
      { numeric: false, text: " h" },
    ]);
  });

  it("keeps a percent sign with its number, as one figure", () => {
    expect(splitQuantity("3.48%")).toStrictEqual([{ numeric: true, text: "3.48%" }]);
    expect(splitQuantity("3,48\u00A0%")).toStrictEqual([{ numeric: true, text: "3,48\u00A0%" }]);
  });
});
