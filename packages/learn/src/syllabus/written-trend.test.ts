import { describe, expect, it } from "vitest";
import { getTrendBarShares } from "./written-trend";

describe(getTrendBarShares, () => {
  it("shows no trend for one answer", () => {
    expect(getTrendBarShares([3])).toStrictEqual([]);
  });

  it("shows both answers relative to the higher value", () => {
    expect(getTrendBarShares([2, 4])).toStrictEqual([0.5, 1]);
  });
});
