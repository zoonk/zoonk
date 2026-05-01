import { describe, expect, it } from "vitest";
import { formatPosition, validateOffset } from "./number";

describe(validateOffset, () => {
  it("parses valid positive integer", () => {
    expect(validateOffset("3")).toBe(3);
  });

  it("floors decimal values", () => {
    expect(validateOffset("3.7")).toBe(3);
  });

  it("returns 0 for undefined", () => {
    expect(validateOffset()).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(validateOffset("abc")).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(validateOffset("Infinity")).toBe(0);
  });

  it("returns 0 for negative values", () => {
    expect(validateOffset("-5")).toBe(0);
  });

  it("returns 0 for negative decimals", () => {
    expect(validateOffset("-0.5")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(validateOffset("")).toBe(0);
  });
});

describe(formatPosition, () => {
  it("formats single digit positions with leading zero", () => {
    expect(formatPosition(0)).toBe("01");
    expect(formatPosition(8)).toBe("09");
  });

  it("formats double digit positions without leading zero", () => {
    expect(formatPosition(9)).toBe("10");
    expect(formatPosition(99)).toBe("100");
  });
});
