import { describe, expect, it } from "vitest";
import { formatFixedPoints, formatPointsRange } from "./format-points-range";

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

  it("rounds one grade to the nearest step, as its detail rows are", () => {
    expect(format({ high: 48.01, low: 48.01 }, { kind: "estimate" })).toBe("48");

    expect(format({ high: 20.5, low: 20.5 }, { kind: "estimate" })).toBe(
      format({ high: 20.5, low: 20.5 }),
    );
  });

  it("shows a zero and collapses equal ends", () => {
    expect(format({ high: 0, low: 0 }, { kind: "estimate" })).toBe("0");
    expect(format({ high: 12.34, low: 12.34 }, { decimals: 2, kind: "estimate" })).toBe("12.34");
    expect(format({ high: 12.404, low: 12.401 }, { decimals: 2 })).toBe("12.40");
  });

  it('keeps one decimal for deductions and reads "0" when nothing is taken', () => {
    expect(format({ high: 0.6, low: 0.3 }, { decimals: 2, kind: "deduction" })).toBe(
      "−0.3 to −0.6",
    );

    expect(format({ high: 0, low: 0 }, { kind: "deduction" })).toBe("0");
    expect(format({ high: 0.04, low: 0 }, { kind: "deduction" })).toBe("0");
    expect(format({ high: 0.35, low: 0.02 }, { kind: "deduction" })).toBe("0.0 to −0.4");
    expect(format({ high: 0.6, low: 0.6 }, { kind: "deduction" })).toBe("−0.6");
  });
});

describe(formatFixedPoints, () => {
  it("writes a maximum as it is, never padded to its mark's decimals", () => {
    expect(formatFixedPoints(22, number)).toBe("22");
    expect(formatFixedPoints(9.5, number)).toBe("9.5");
    expect(formatFixedPoints(1.25, number)).toBe("1.25");

    expect(
      `${format({ high: 14.67, low: 14.67 }, { decimals: 1 })} of ${formatFixedPoints(22, number)}`,
    ).toBe("14.7 of 22");
  });
});
