import { describe, expect, it } from "vitest";
import { normalizePenalty } from "./marking-penalty";

describe(normalizePenalty, () => {
  it.each([
    [0.333, 1 / 3],
    [0.1667, 1 / 6],
    [0.666667, 2 / 3],
    [0.318, 0.318],
  ])(
    "normalizes %s without changing deductions beyond the fraction tolerance",
    (input, expected) => {
      expect(normalizePenalty(input)).toBe(expected);
    },
  );
});
