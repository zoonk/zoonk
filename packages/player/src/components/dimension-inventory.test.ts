import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { describe, expect, test } from "vitest";
import { hasNegativeDimension } from "../has-negative-dimension";
import { type DimensionInventory } from "../player-reducer";
import { buildDimensionEntries } from "./dimension-inventory";

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

describe(buildDimensionEntries, () => {
  test("returns all dimensions with zero deltas when no effects", () => {
    const dims: DimensionInventory = { Courage: 2, Diplomacy: 1 };
    const effects: ChallengeEffect[] = [];

    expect(buildDimensionEntries(dims, effects)).toEqual([
      { delta: 0, name: "Courage", total: 2 },
      { delta: 0, name: "Diplomacy", total: 1 },
    ]);
  });

  test("computes deltas from effects for matching dimensions", () => {
    const dims: DimensionInventory = { Courage: 3, Diplomacy: 1, Morale: 2 };
    const effects: ChallengeEffect[] = [
      { dimension: "Courage", impact: "positive" },
      { dimension: "Diplomacy", impact: "negative" },
    ];

    expect(buildDimensionEntries(dims, effects)).toEqual([
      { delta: 1, name: "Courage", total: 3 },
      { delta: 0, name: "Morale", total: 2 },
      { delta: -1, name: "Diplomacy", total: 1 },
    ]);
  });

  test("handles multiple effects on the same dimension", () => {
    const dims: DimensionInventory = { Courage: 4 };
    const effects: ChallengeEffect[] = [
      { dimension: "Courage", impact: "positive" },
      { dimension: "Courage", impact: "positive" },
    ];

    expect(buildDimensionEntries(dims, effects)).toEqual([{ delta: 2, name: "Courage", total: 4 }]);
  });

  test("returns entries sorted by total descending, then alphabetically", () => {
    const dims: DimensionInventory = { Courage: 2, Diplomacy: 0, Morale: 1 };
    const result = buildDimensionEntries(dims, []);

    expect(result.map((entry) => entry.name)).toEqual(["Courage", "Morale", "Diplomacy"]);
  });

  test("uses alphabetical order as tiebreaker for equal totals", () => {
    const dims: DimensionInventory = { Courage: 2, Diplomacy: 2, Morale: 2 };
    const result = buildDimensionEntries(dims, []);

    expect(result.map((entry) => entry.name)).toEqual(["Courage", "Diplomacy", "Morale"]);
  });
});
