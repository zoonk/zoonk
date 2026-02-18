import { describe, expect, test } from "vitest";
import { hasNegativeDimension } from "./has-negative-dimension";

describe(hasNegativeDimension, () => {
  test("returns true when any dimension is negative", () => {
    expect(hasNegativeDimension({ Courage: 2, Diplomacy: -1, Speed: 0 })).toBeTruthy();
  });

  test("returns false when all dimensions are non-negative", () => {
    expect(hasNegativeDimension({ Courage: 2, Diplomacy: 0, Speed: 1 })).toBeFalsy();
  });

  test("returns false for empty dimensions", () => {
    expect(hasNegativeDimension({})).toBeFalsy();
  });

  test("returns true when all dimensions are negative", () => {
    expect(hasNegativeDimension({ Courage: -1, Diplomacy: -2 })).toBeTruthy();
  });
});
