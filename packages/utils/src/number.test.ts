import { describe, expect, test } from "vitest";
import { formatPosition, parseNumericId, validateOffset } from "./number";

describe(validateOffset, () => {
  test("parses valid positive integer", () => {
    expect(validateOffset("3")).toBe(3);
  });

  test("floors decimal values", () => {
    expect(validateOffset("3.7")).toBe(3);
  });

  test("returns 0 for undefined", () => {
    expect(validateOffset()).toBe(0);
  });

  test("returns 0 for NaN", () => {
    expect(validateOffset("abc")).toBe(0);
  });

  test("returns 0 for Infinity", () => {
    expect(validateOffset("Infinity")).toBe(0);
  });

  test("returns 0 for negative values", () => {
    expect(validateOffset("-5")).toBe(0);
  });

  test("returns 0 for negative decimals", () => {
    expect(validateOffset("-0.5")).toBe(0);
  });

  test("returns 0 for empty string", () => {
    expect(validateOffset("")).toBe(0);
  });
});

describe(parseNumericId, () => {
  test("parses valid numeric strings", () => {
    expect(parseNumericId("123")).toBe(123);
    expect(parseNumericId("0")).toBe(0);
    expect(parseNumericId("999999")).toBe(999_999);
  });

  test("parses numeric strings with surrounding whitespace", () => {
    expect(parseNumericId(" 123")).toBe(123);
    expect(parseNumericId("123 ")).toBe(123);
    expect(parseNumericId(" 123 ")).toBe(123);
  });

  test("parses valid integer numbers directly", () => {
    expect(parseNumericId(123)).toBe(123);
    expect(parseNumericId(0)).toBe(0);
  });

  test("returns null for strings with letters", () => {
    expect(parseNumericId("123abc")).toBeNull();
    expect(parseNumericId("abc123")).toBeNull();
    expect(parseNumericId("1a2b3c")).toBeNull();
  });

  test("returns null for strings with special characters", () => {
    expect(parseNumericId("123.45")).toBeNull();
    expect(parseNumericId("123-45")).toBeNull();
    expect(parseNumericId("123_45")).toBeNull();
    expect(parseNumericId("+123")).toBeNull();
    expect(parseNumericId("-123")).toBeNull();
  });

  test("returns null for malformed whitespace-delimited strings", () => {
    expect(parseNumericId("12 34")).toBeNull();
  });

  test("returns null for empty or unsupported values", () => {
    expect(parseNumericId("")).toBeNull();
    expect(parseNumericId("   ")).toBeNull();
    expect(parseNumericId(3.7)).toBeNull();
    expect(parseNumericId(null)).toBeNull();
    expect(parseNumericId()).toBeNull();
  });
});

describe(formatPosition, () => {
  test("formats single digit positions with leading zero", () => {
    expect(formatPosition(0)).toBe("01");
    expect(formatPosition(8)).toBe("09");
  });

  test("formats double digit positions without leading zero", () => {
    expect(formatPosition(9)).toBe("10");
    expect(formatPosition(99)).toBe("100");
  });
});
