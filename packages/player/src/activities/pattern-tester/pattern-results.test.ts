import { describe, expect, it } from "vitest";
import { testFormula, testRegex } from "./pattern-results";

const zip = {
  shouldMatch: ["94103", "94103-1234"],
  shouldNotMatch: ["9410", "941031", "94103-12"],
};

describe(testRegex, () => {
  it("marks where the pattern matches and whether each example passes", () => {
    const results = testRegex(String.raw`^\d{5}`, zip);

    expect(results).toMatchObject({
      shouldMatch: [
        { match: { end: 5, start: 0 }, passes: true, sample: "94103" },
        { match: { end: 5, start: 0 }, passes: true, sample: "94103-1234" },
      ],
      shouldNotMatch: [
        { match: null, passes: true, sample: "9410" },
        { passes: false, sample: "941031" },
        { passes: false, sample: "94103-12" },
      ],
      status: "tested",
    });
  });

  it("passes every example with the full pattern", () => {
    const results = testRegex(String.raw`^\d{5}(-\d{4})?$`, zip);

    expect(
      results.status === "tested" &&
        [...results.shouldMatch, ...results.shouldNotMatch].every((row) => row.passes),
    ).toBe(true);
  });

  it("refuses patterns grading refuses", () => {
    expect(testRegex("", zip)).toStrictEqual({ status: "empty" });
    expect(testRegex("(", zip)).toStrictEqual({ status: "invalid" });
    expect(testRegex("(a+)+$", zip)).toStrictEqual({ status: "invalid" });
  });
});

describe(testFormula, () => {
  const examples = [
    { inputs: { A1: 100, B1: 0.2 }, output: 120 },
    { inputs: { A1: 50, B1: 0.1 }, output: 55 },
  ];

  it("gives each example's value and whether it's within tolerance", () => {
    expect(
      testFormula("=A1*(1+B1)", { examples, tolerance: { kind: "absolute", value: 0.01 } }),
    ).toStrictEqual([
      { expected: 120, passes: true, value: 120 },
      { expected: 55, passes: true, value: 55.00000000000001 },
    ]);

    expect(
      testFormula("A1+B1", { examples, tolerance: { kind: "absolute", value: 0.01 } }),
    ).toStrictEqual([
      { expected: 120, passes: false, value: 100.2 },
      { expected: 55, passes: false, value: 50.1 },
    ]);
  });

  it("has no value while the formula is empty or unfinished", () => {
    expect(
      testFormula("", { examples, tolerance: { kind: "absolute", value: 0 } })[0],
    ).toStrictEqual({ expected: 120, passes: false, value: null });

    expect(
      testFormula("A1*(", { examples, tolerance: { kind: "absolute", value: 0 } })[0]?.value,
    ).toBeNull();
  });
});
