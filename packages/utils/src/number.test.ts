import { describe, expect, it } from "vitest";
import { validateOffset } from "./number";

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
