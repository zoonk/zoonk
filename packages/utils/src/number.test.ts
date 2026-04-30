import { describe, expect, it } from "vitest";
import { formatPosition, parseNumericId, validateOffset } from "./number";

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

describe(parseNumericId, () => {
  it("parses valid numeric strings", () => {
    expect(parseNumericId("123")).toBe(123);
    expect(parseNumericId("0")).toBe(0);
    expect(parseNumericId("999999")).toBe(999_999);
  });

  it("parses numeric strings with surrounding whitespace", () => {
    expect(parseNumericId(" 123")).toBe(123);
    expect(parseNumericId("123 ")).toBe(123);
    expect(parseNumericId(" 123 ")).toBe(123);
  });

  it("parses valid integer numbers directly", () => {
    expect(parseNumericId(123)).toBe(123);
    expect(parseNumericId(0)).toBe(0);
  });

  it("returns null for strings with letters", () => {
    expect(parseNumericId("123abc")).toBeNull();
    expect(parseNumericId("abc123")).toBeNull();
    expect(parseNumericId("1a2b3c")).toBeNull();
  });

  it("returns null for strings with special characters", () => {
    expect(parseNumericId("123.45")).toBeNull();
    expect(parseNumericId("123-45")).toBeNull();
    expect(parseNumericId("123_45")).toBeNull();
    expect(parseNumericId("+123")).toBeNull();
    expect(parseNumericId("-123")).toBeNull();
  });

  it("returns null for malformed whitespace-delimited strings", () => {
    expect(parseNumericId("12 34")).toBeNull();
  });

  it("returns null for empty or unsupported values", () => {
    expect(parseNumericId("")).toBeNull();
    expect(parseNumericId("   ")).toBeNull();
    expect(parseNumericId(3.7)).toBeNull();
    expect(parseNumericId(null)).toBeNull();
    expect(parseNumericId()).toBeNull();
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
