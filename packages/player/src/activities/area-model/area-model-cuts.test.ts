import { describe, expect, it } from "vitest";
import { cutsToParts, moveCut, partsToCuts, splitStep } from "./area-model-cuts";

describe(partsToCuts, () => {
  it("places split lines at the running totals", () => {
    expect(partsToCuts([20, 3])).toStrictEqual([20]);
    expect(partsToCuts([10, 10, 4])).toStrictEqual([10, 20]);
    expect(partsToCuts([14])).toStrictEqual([]);
  });
});

describe(cutsToParts, () => {
  it("reads the parts back without float noise", () => {
    expect(cutsToParts([20], 23)).toStrictEqual([20, 3]);
    expect(cutsToParts([0.1, 0.3], 0.6)).toStrictEqual([0.1, 0.2, 0.3]);
  });
});

describe(splitStep, () => {
  it("uses the roundest step that reaches every part", () => {
    expect(splitStep([20, 3])).toBe(1);
    expect(splitStep([2.5, 1])).toBe(0.5);
    expect(splitStep([0.2, 0.1])).toBe(0.1);
  });
});

describe(moveCut, () => {
  it("snaps a moved split to the step", () => {
    expect(moveCut({ cuts: [20], index: 0, step: 1, total: 23, value: 17.6 })).toStrictEqual([18]);
  });

  it("keeps every part at least one step wide", () => {
    expect(moveCut({ cuts: [10, 20], index: 0, step: 1, total: 23, value: 25 })).toStrictEqual([
      19, 20,
    ]);

    expect(moveCut({ cuts: [10, 20], index: 1, step: 1, total: 23, value: 30 })).toStrictEqual([
      10, 22,
    ]);

    expect(moveCut({ cuts: [5], index: 0, step: 1, total: 23, value: -4 })).toStrictEqual([1]);
  });
});
