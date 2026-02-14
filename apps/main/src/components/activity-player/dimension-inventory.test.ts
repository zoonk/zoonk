import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { describe, expect, test } from "vitest";
import {
  buildDimensionEntries,
  formatDelta,
  getDeltaColor,
  getStatusTotalColor,
  hasNegativeDimension,
} from "./dimension-inventory";
import { type DimensionInventory } from "./player-reducer";

describe(hasNegativeDimension, () => {
  test("returns false for empty dimensions", () => {
    expect(hasNegativeDimension({})).toBeFalsy();
  });

  test("returns false when all values are positive", () => {
    const dims: DimensionInventory = { Courage: 2, Diplomacy: 1 };
    expect(hasNegativeDimension(dims)).toBeFalsy();
  });

  test("returns false when all values are zero", () => {
    const dims: DimensionInventory = { Courage: 0, Diplomacy: 0 };
    expect(hasNegativeDimension(dims)).toBeFalsy();
  });

  test("returns true when any value is negative", () => {
    const dims: DimensionInventory = { Courage: 2, Diplomacy: -1, Morale: 0 };
    expect(hasNegativeDimension(dims)).toBeTruthy();
  });
});

describe(formatDelta, () => {
  test("formats positive delta with plus sign", () => {
    expect(formatDelta(1)).toBe("+1");
  });

  test("formats negative delta as-is", () => {
    expect(formatDelta(-1)).toBe("-1");
  });

  test("formats zero delta with plus sign", () => {
    expect(formatDelta(0)).toBe("+0");
  });

  test("formats larger values", () => {
    expect(formatDelta(3)).toBe("+3");
    expect(formatDelta(-5)).toBe("-5");
  });
});

describe(getDeltaColor, () => {
  test("returns success color for positive delta", () => {
    expect(getDeltaColor(1)).toBe("text-success");
  });

  test("returns destructive color for negative delta", () => {
    expect(getDeltaColor(-1)).toBe("text-destructive");
  });

  test("returns success color for zero delta", () => {
    expect(getDeltaColor(0)).toBe("text-success");
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

describe(getStatusTotalColor, () => {
  test("returns text-foreground for positive total", () => {
    expect(getStatusTotalColor(3)).toBe("text-foreground");
  });

  test("returns text-warning for zero total", () => {
    expect(getStatusTotalColor(0)).toBe("text-warning");
  });

  test("returns text-destructive for negative total", () => {
    expect(getStatusTotalColor(-1)).toBe("text-destructive");
  });
});
