import { describe, expect, it } from "vitest";
import { clampCefrScore, formatCefrScore, isCefrLevel, parseCefrScore, toCefrLevel } from "./cefr";

describe(parseCefrScore, () => {
  it("reads bands and plus levels", () => {
    expect(parseCefrScore("A1")).toBe(0);
    expect(parseCefrScore("A2")).toBe(1);
    expect(parseCefrScore("A2+")).toBe(1.5);
    expect(parseCefrScore(" b1+ ")).toBe(2.5);
    expect(parseCefrScore("C2")).toBe(5);
  });

  it("keeps C2+ at the top of the scale", () => {
    expect(parseCefrScore("C2+")).toBe(5);
  });

  it("returns null for anything that isn't a level", () => {
    expect(parseCefrScore("B3")).toBeNull();
    expect(parseCefrScore("intermediate")).toBeNull();
    expect(parseCefrScore(null)).toBeNull();
    expect(parseCefrScore(2)).toBeNull();
  });
});

describe(formatCefrScore, () => {
  it("shows half steps with a plus", () => {
    expect(formatCefrScore(1)).toBe("A2");
    expect(formatCefrScore(1.5)).toBe("A2+");
    expect(formatCefrScore(2.4)).toBe("B1+");
  });

  it("clamps to the scale", () => {
    expect(formatCefrScore(-1)).toBe("A1");
    expect(formatCefrScore(9)).toBe("C2");
  });
});

describe(clampCefrScore, () => {
  it("rounds to the nearest half step", () => {
    expect(clampCefrScore(1.2)).toBe(1);
    expect(clampCefrScore(1.3)).toBe(1.5);
  });
});

describe(toCefrLevel, () => {
  it("gives the band of a plus level", () => {
    expect(toCefrLevel(2.5)).toBe("B1");
  });
});

describe(isCefrLevel, () => {
  it("accepts only the six bands", () => {
    expect(isCefrLevel("B2")).toBe(true);
    expect(isCefrLevel("B2+")).toBe(false);
  });
});
