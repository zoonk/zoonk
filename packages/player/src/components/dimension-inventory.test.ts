import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { describe, expect, test } from "vitest";
import { type DimensionInventory } from "../player-reducer";
import { buildDimensionEntries } from "./dimension-inventory";

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
      { delta: -1, name: "Diplomacy", total: 1 },
      { delta: 0, name: "Morale", total: 2 },
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

  test("sorts negative totals first, then zero, then positive", () => {
    const dims: DimensionInventory = { Courage: 2, Diplomacy: -1, Morale: 0 };
    const result = buildDimensionEntries(dims, []);

    expect(result.map((entry) => entry.name)).toEqual(["Diplomacy", "Morale", "Courage"]);
  });

  test("sorts most negative first within negative tier", () => {
    const dims: DimensionInventory = { Budget: -1, Courage: 2, Trust: -3 };
    const result = buildDimensionEntries(dims, []);

    expect(result.map((entry) => entry.name)).toEqual(["Trust", "Budget", "Courage"]);
  });

  test("uses alphabetical order as tiebreaker for equal totals", () => {
    const dims: DimensionInventory = { Courage: 2, Diplomacy: 2, Morale: 2 };
    const result = buildDimensionEntries(dims, []);

    expect(result.map((entry) => entry.name)).toEqual(["Courage", "Diplomacy", "Morale"]);
  });
});
