import { describe, expect, it } from "vitest";
import { snapToStep, valueAfterKey } from "./snap-value";

const range = { max: 12, min: 0, step: 0.5 };

describe(snapToStep, () => {
  it("lands on a reachable position without float noise", () => {
    expect(snapToStep(7.3, range)).toBe(7.5);
    expect(snapToStep(0.1 + 0.2, { max: 1, min: 0, step: 0.1 })).toBe(0.3);
  });

  it("counts steps from the minimum and stays in range", () => {
    expect(snapToStep(4, { max: 9, min: -5, step: 3 })).toBe(4);
    expect(snapToStep(40, range)).toBe(12);
    expect(snapToStep(-3, range)).toBe(0);
  });
});

describe(valueAfterKey, () => {
  it("moves like a native slider", () => {
    expect(valueAfterKey("ArrowRight", 5, range)).toBe(5.5);
    expect(valueAfterKey("ArrowDown", 5, range)).toBe(4.5);
    expect(valueAfterKey("PageUp", 5, range)).toBe(10);
    expect(valueAfterKey("Home", 5, range)).toBe(0);
    expect(valueAfterKey("End", 5, range)).toBe(12);
    expect(valueAfterKey("PageUp", 11, range)).toBe(12);
  });

  it("ignores keys that don't move the handle", () => {
    expect(valueAfterKey("Enter", 5, range)).toBeNull();
  });
});
