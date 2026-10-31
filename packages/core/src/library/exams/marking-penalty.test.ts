import { describe, expect, it } from "vitest";
import { getMarkingPenalty, normalizePenalty } from "./marking-penalty";

describe(normalizePenalty, () => {
  it.each([
    [0.333, 1 / 3],
    [0.1667, 1 / 6],
    [0.666667, 2 / 3],
    [0.318, 0.318],
    [0.33, 1 / 3],
    [0.66, 2 / 3],
    [0.67, 2 / 3],
    [0.83, 5 / 6],
    [0.4, 0.4],
    [0.21, 0.21],
    [2.45, 2.45],
    [0.249, 0.249],
    [0.49, 0.49],
  ])(
    "normalizes %s without changing deductions beyond the fraction tolerance",
    (input, expected) => {
      expect(normalizePenalty(input)).toBe(expected);
    },
  );
});

describe(getMarkingPenalty, () => {
  it.each([
    { points: 5, wrongPoints: 0.4 },
    { points: 2.5, wrongPoints: 0.21 },
    { points: 10, wrongPoints: 2.45 },
  ])("preserves a stated $wrongPoints deduction on a $points point item", (row) => {
    expect(getMarkingPenalty(row)).toBe(row.wrongPoints / row.points);
  });
});
