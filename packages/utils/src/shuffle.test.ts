import { describe, expect, test } from "vitest";
import { shuffle } from "./shuffle";

describe(shuffle, () => {
  test("returns a new array (no mutation)", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  test("contains same elements as input", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result.toSorted((left, right) => left - right)).toEqual([1, 2, 3, 4, 5]);
  });

  test("empty array returns empty array", () => {
    expect(shuffle([])).toEqual([]);
  });

  test("single element returns same element", () => {
    expect(shuffle([42])).toEqual([42]);
  });

  test("large array preserves all elements", () => {
    const input = Array.from({ length: 100 }, (_, idx) => idx);
    const result = shuffle(input);
    expect(result).toHaveLength(100);
    expect(result.toSorted((left, right) => left - right)).toEqual(input);
  });
});
