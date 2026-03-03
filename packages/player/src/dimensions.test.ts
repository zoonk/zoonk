import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { describe, expect, it } from "vitest";
import { computeDimensions, hasNegativeDimension } from "./dimensions";

describe(computeDimensions, () => {
  it("returns empty dimensions for empty effects", () => {
    expect(computeDimensions([])).toEqual({});
  });

  it("returns +1 for a single positive effect", () => {
    const effects: ChallengeEffect[][] = [[{ dimension: "health", impact: "positive" }]];
    expect(computeDimensions(effects)).toEqual({ health: 1 });
  });

  it("returns -1 for a single negative effect", () => {
    const effects: ChallengeEffect[][] = [[{ dimension: "health", impact: "negative" }]];
    expect(computeDimensions(effects)).toEqual({ health: -1 });
  });

  it("returns 0 for a single neutral effect", () => {
    const effects: ChallengeEffect[][] = [[{ dimension: "health", impact: "neutral" }]];
    expect(computeDimensions(effects)).toEqual({ health: 0 });
  });

  it("accumulates effects across multiple steps", () => {
    const effects: ChallengeEffect[][] = [
      [{ dimension: "health", impact: "positive" }],
      [{ dimension: "health", impact: "positive" }],
      [{ dimension: "health", impact: "negative" }],
    ];
    expect(computeDimensions(effects)).toEqual({ health: 1 });
  });

  it("handles mixed dimensions across steps", () => {
    const effects: ChallengeEffect[][] = [
      [
        { dimension: "health", impact: "positive" },
        { dimension: "wealth", impact: "negative" },
      ],
      [
        { dimension: "health", impact: "negative" },
        { dimension: "reputation", impact: "positive" },
      ],
    ];
    expect(computeDimensions(effects)).toEqual({ health: 0, reputation: 1, wealth: -1 });
  });
});

describe(hasNegativeDimension, () => {
  it("returns true when any dimension is negative", () => {
    expect(hasNegativeDimension({ Courage: 2, Diplomacy: -1, Speed: 0 })).toBeTruthy();
  });

  it("returns false when all dimensions are non-negative", () => {
    expect(hasNegativeDimension({ Courage: 2, Diplomacy: 0, Speed: 1 })).toBeFalsy();
  });

  it("returns false for empty dimensions", () => {
    expect(hasNegativeDimension({})).toBeFalsy();
  });

  it("returns true when all dimensions are negative", () => {
    expect(hasNegativeDimension({ Courage: -1, Diplomacy: -2 })).toBeTruthy();
  });
});
