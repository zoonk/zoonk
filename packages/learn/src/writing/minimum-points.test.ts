import { describe, expect, it } from "vitest";
import { getMinimumPoints } from "./minimum-points";

describe(getMinimumPoints, () => {
  it("turns a percent minimum into the points it asks for on its scale", () => {
    expect(getMinimumPoints({ max: 40, minimum: { unit: "percent", value: 50 } })).toBe(20);
  });

  it("keeps a minimum stated in points", () => {
    expect(getMinimumPoints({ max: 100, minimum: { unit: "points", value: 50 } })).toBe(50);
  });

  it("can't say a percent minimum in points without the scale", () => {
    expect(getMinimumPoints({ max: null, minimum: { unit: "percent", value: 50 } })).toBeNull();
  });
});
