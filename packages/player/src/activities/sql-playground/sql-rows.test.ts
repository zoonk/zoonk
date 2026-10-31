import { describe, expect, it } from "vitest";
import { compareRows } from "./sql-rows";

const expected = [
  ["India", 1451],
  ["China", 1419],
  ["Indonesia", 283],
];

describe(compareRows, () => {
  it("marks extra and missing rows when order doesn't matter", () => {
    expect(
      compareRows({
        actual: [
          ["China", 1419],
          ["India", 1451],
          ["Brazil", 212],
        ],
        expected,
        orderMatters: false,
      }),
    ).toStrictEqual({ actualMatched: [true, true, false], expectedFound: [true, true, false] });
  });

  it("compares position by position when order matters", () => {
    expect(
      compareRows({
        actual: [
          ["China", 1419],
          ["India", 1451],
          ["Indonesia", 283],
        ],
        expected,
        orderMatters: true,
      }),
    ).toStrictEqual({ actualMatched: [false, false, true], expectedFound: [false, false, true] });
  });

  it("tells a number from the same digits as text", () => {
    expect(
      compareRows({
        actual: [["India", "1451"]],
        expected: [["India", 1451]],
        orderMatters: false,
      }),
    ).toStrictEqual({ actualMatched: [false], expectedFound: [false] });
  });
});
