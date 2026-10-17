import { describe, expect, it } from "vitest";
import {
  type BalanceState,
  applyMove,
  canDrawBlocks,
  isolatedValue,
  panText,
  parseBalance,
  reachedSteps,
  solveBalance,
  splitGroups,
  tiltDegrees,
} from "./balance-model";

const start: BalanceState = { left: { units: 1, x: 4 }, right: { units: 7, x: 2 } };
const format = (value: number) => String(value);

describe(parseBalance, () => {
  it("reads each linear side as unknowns and units", () => {
    expect(parseBalance({ left: "4*x + 1", right: "7" }, "x")).toStrictEqual({
      left: { units: 1, x: 4 },
      right: { units: 7, x: 0 },
    });

    expect(parseBalance({ left: "2*(x + 3)", right: "x" }, "x")?.left).toStrictEqual({
      units: 6,
      x: 2,
    });
  });

  it("rejects sides that aren't linear or don't evaluate", () => {
    expect(parseBalance({ left: "x^2", right: "4" }, "x")).toBeNull();
    expect(parseBalance({ left: "y + 1", right: "4" }, "x")).toBeNull();
  });
});

describe(solveBalance, () => {
  it("finds the unknown that keeps both pans level", () => {
    expect(solveBalance(start)).toBe(3);
    expect(solveBalance({ left: { units: 1, x: 2 }, right: { units: 1, x: 2 } })).toBeNull();
  });
});

describe(canDrawBlocks, () => {
  it("draws small whole counts with a positive unknown", () => {
    expect(canDrawBlocks(start, 3)).toBe(true);
  });

  it("falls back to symbols for negatives, fractions, big counts or a weightless bag", () => {
    const parsed = parseBalance({ left: "3*x - 2", right: "7" }, "x");

    expect(parsed && canDrawBlocks(parsed, solveBalance(parsed))).toBe(false);
    expect(canDrawBlocks({ left: { units: 0, x: 0.5 }, right: { units: 2, x: 0 } }, 4)).toBe(false);

    expect(canDrawBlocks({ left: { units: 40, x: 1 }, right: { units: 50, x: 0 } }, 10)).toBe(
      false,
    );

    expect(canDrawBlocks({ left: { units: 1, x: 2 }, right: { units: 1, x: 0 } }, 0)).toBe(false);
  });
});

describe(tiltDegrees, () => {
  it("stays level when both pans weigh the same", () => {
    expect(tiltDegrees(start, 3)).toBe(0);
  });

  it("tips toward the heavier pan", () => {
    const leftOnly = applyMove(applyMove(start, { kind: "takeX", side: "left" }), {
      kind: "takeX",
      side: "left",
    });

    expect(tiltDegrees(leftOnly, 3)).toBeGreaterThan(0);
    expect(tiltDegrees(applyMove(start, { kind: "takeUnit", side: "right" }), 3)).toBeLessThan(0);
  });
});

describe(applyMove, () => {
  it("takes one unknown or unit off a pan, never below zero", () => {
    expect(applyMove(start, { kind: "takeUnit", side: "left" }).left).toStrictEqual({
      units: 0,
      x: 4,
    });

    const empty: BalanceState = { left: { units: 0, x: 0 }, right: { units: 3, x: 1 } };
    expect(applyMove(empty, { kind: "takeX", side: "left" })).toStrictEqual(empty);
  });

  it("splits both pans into equal groups", () => {
    const grouped: BalanceState = { left: { units: 0, x: 2 }, right: { units: 6, x: 0 } };

    expect(splitGroups(grouped)).toBe(2);

    expect(applyMove(grouped, { groups: 2, kind: "split" })).toStrictEqual({
      left: { units: 0, x: 1 },
      right: { units: 3, x: 0 },
    });
  });

  it("only offers a split when the unknowns stand alone against units", () => {
    expect(splitGroups(start)).toBeNull();
    expect(splitGroups({ left: { units: 6, x: 0 }, right: { units: 0, x: 3 } })).toBe(3);
  });
});

describe(isolatedValue, () => {
  it("reads the answer when one unknown stands alone on either side", () => {
    expect(isolatedValue({ left: { units: 0, x: 1 }, right: { units: 3, x: 0 } })).toBe(3);
    expect(isolatedValue({ left: { units: 3, x: 0 }, right: { units: 0, x: 1 } })).toBe(3);
    expect(isolatedValue(start)).toBeNull();
  });
});

describe(reachedSteps, () => {
  const steps = [
    parseBalance({ left: "2*x + 1", right: "7" }, "x"),
    parseBalance({ left: "2*x", right: "6" }, "x"),
    parseBalance({ left: "x", right: "3" }, "x"),
  ];

  it("counts written steps reached in order, on either side", () => {
    const afterBags: BalanceState = { left: { units: 1, x: 2 }, right: { units: 7, x: 0 } };
    expect(reachedSteps({ current: afterBags, history: [start], solution: 3, steps })).toBe(1);

    const mirrored: BalanceState = { left: { units: 6, x: 0 }, right: { units: 0, x: 2 } };
    expect(reachedSteps({ current: mirrored, history: [afterBags], solution: 3, steps })).toBe(2);
  });

  it("counts every step once the answer is reached by another path", () => {
    const solved: BalanceState = { left: { units: 0, x: 1 }, right: { units: 3, x: 0 } };
    expect(reachedSteps({ current: solved, history: [], solution: 3, steps })).toBe(3);
  });
});

describe(panText, () => {
  it("writes a pan in symbols", () => {
    expect(panText({ units: 1, x: 4 }, "x", format)).toBe("4x + 1");
    expect(panText({ units: 0, x: 1 }, "x", format)).toBe("x");
    expect(panText({ units: 7, x: 0 }, "x", format)).toBe("7");
    expect(panText({ units: 0, x: 0 }, "x", format)).toBe("0");
  });
});
