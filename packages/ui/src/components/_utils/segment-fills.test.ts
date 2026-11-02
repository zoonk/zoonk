import { describe, expect, it } from "vitest";
import { getSegmentFills } from "./segment-fills";

describe(getSegmentFills, () => {
  it("fills the segments in order, each by its share of the bar", () => {
    expect(getSegmentFills({ value: 0, weights: [1, 1, 2] })).toStrictEqual([0, 0, 0]);
    expect(getSegmentFills({ value: 25, weights: [1, 1, 2] })).toStrictEqual([1, 0, 0]);
    expect(getSegmentFills({ value: 37.5, weights: [1, 1, 2] })).toStrictEqual([1, 0.5, 0]);
    expect(getSegmentFills({ value: 75, weights: [1, 1, 2] })).toStrictEqual([1, 1, 0.5]);
    expect(getSegmentFills({ value: 100, weights: [1, 1, 2] })).toStrictEqual([1, 1, 1]);
  });

  it("keeps values outside 0 to 100 on the bar", () => {
    expect(getSegmentFills({ value: -10, weights: [1, 1] })).toStrictEqual([0, 0]);
    expect(getSegmentFills({ value: 140, weights: [1, 1] })).toStrictEqual([1, 1]);
  });

  it("leaves a bar without weight empty", () => {
    expect(getSegmentFills({ value: 50, weights: [0, 0] })).toStrictEqual([0, 0]);
    expect(getSegmentFills({ value: 50, weights: [] })).toStrictEqual([]);
  });
});
