import { describe, expect, it } from "vitest";
import { getWaitChanges, getWaitState } from "./wait-state";

describe(getWaitState, () => {
  it("says nothing for a quick tap, then that it's on its way, then that it's slow", () => {
    expect(
      [0, 1499, 1500, 14_999, 15_000, 60_000].map((elapsed) => getWaitState(elapsed)),
    ).toStrictEqual(["none", "none", "slow", "slow", "verySlow", "verySlow"]);
  });
});

describe(getWaitChanges, () => {
  it("counts down from the tap, so a wait shown on another screen keeps its place", () => {
    expect(getWaitChanges(0)).toStrictEqual([1500, 15_000]);
    expect(getWaitChanges(1000)).toStrictEqual([500, 14_000]);
    expect(getWaitChanges(1500)).toStrictEqual([13_500]);
    expect(getWaitChanges(15_000)).toStrictEqual([]);
  });
});
