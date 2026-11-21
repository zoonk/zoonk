import { describe, expect, it } from "vitest";
import { formatPointsRange } from "./format-points-range";

const number = (value: number, options: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("en-US", options).format(value);

const joinDeduction = (low: string, high: string) => `${low} to ${high}`;

function format(
  range: { high: number; low: number },
  options: Pick<Parameters<typeof formatPointsRange>[0], "decimals" | "kind"> = {},
) {
  return formatPointsRange({ joinDeduction, number, range, ...options });
}

describe(formatPointsRange, () => {
  it("rounds a written part's estimate outward and rounds its detail to the nearest step", () => {
    const part = { high: 82.4, low: 71.4 };

    expect(format(part, { kind: "estimate" })).toBe("71–83");
    expect(format(part)).toBe("71–82");
  });

  it("uses two decimals for both ends and rounds detail rows to the nearest step", () => {
    const range = { high: 12.406, low: 8.297 };

    expect(format(range, { decimals: 2, kind: "estimate" })).toBe("8.29–12.41");
    expect(format(range, { decimals: 2 })).toBe("8.30–12.41");
  });

  it("shows a zero and collapses equal ends", () => {
    expect(format({ high: 0, low: 0 }, { kind: "estimate" })).toBe("0");
    expect(format({ high: 12.34, low: 12.34 }, { decimals: 2, kind: "estimate" })).toBe("12.34");
    expect(format({ high: 12.404, low: 12.401 }, { decimals: 2 })).toBe("12.40");
  });

  it("keeps one decimal for deductions and drops the minus when a deduction rounds to zero", () => {
    expect(format({ high: 0.6, low: 0.3 }, { decimals: 2, kind: "deduction" })).toBe(
      "−0.3 to −0.6",
    );

    expect(format({ high: 0.04, low: 0 }, { kind: "deduction" })).toBe("0.0");
    expect(format({ high: 0.35, low: 0.02 }, { kind: "deduction" })).toBe("0.0 to −0.4");
    expect(format({ high: 0.6, low: 0.6 }, { kind: "deduction" })).toBe("−0.6");
  });
});
