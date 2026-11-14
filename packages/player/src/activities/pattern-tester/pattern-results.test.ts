import { describe, expect, it } from "vitest";
import { testFormula } from "./pattern-results";

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
