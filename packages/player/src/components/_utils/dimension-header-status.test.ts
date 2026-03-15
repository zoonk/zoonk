import { describe, expect, test } from "vitest";
import { getHeaderDimensionState, getStatusColor } from "./dimension-header-status";

describe(getHeaderDimensionState, () => {
  test("returns all-clear when all dimensions are positive", () => {
    expect(getHeaderDimensionState({ Budget: 2, Trust: 1 })).toEqual({ kind: "all-clear" });
  });

  test("returns all-clear for empty dimensions", () => {
    expect(getHeaderDimensionState({})).toEqual({ kind: "all-clear" });
  });

  test("returns negative with count when any dimension is negative", () => {
    expect(getHeaderDimensionState({ Budget: 2, Trust: -1 })).toEqual({
      count: 1,
      kind: "negative",
    });
  });

  test("counts only negative dimensions, ignoring zero and positive", () => {
    const result = getHeaderDimensionState({ Budget: -2, Morale: 0, Quality: 3, Trust: -1 });

    expect(result).toEqual({ count: 2, kind: "negative" });
  });

  test("returns at-risk with count when no negatives but some at zero", () => {
    expect(getHeaderDimensionState({ Budget: 2, Morale: 0, Trust: 0 })).toEqual({
      count: 2,
      kind: "at-risk",
    });
  });

  test("returns at-risk with single zero dimension", () => {
    expect(getHeaderDimensionState({ Budget: 3, Trust: 0 })).toEqual({
      count: 1,
      kind: "at-risk",
    });
  });
});

describe(getStatusColor, () => {
  test("returns destructive for negative state", () => {
    expect(getStatusColor("negative")).toBe("text-destructive");
  });

  test("returns warning for at-risk state", () => {
    expect(getStatusColor("at-risk")).toBe("text-warning");
  });

  test("returns muted-foreground for all-clear state", () => {
    expect(getStatusColor("all-clear")).toBe("text-muted-foreground");
  });
});
