import { describe, expect, it } from "vitest";
import { getSegmentFills } from "./segment-fills";

describe(getSegmentFills, () => {
  it("fills done steps, and the running step with what the bar drifted past them", () => {
    expect(
      getSegmentFills({
        statuses: ["completed", "active", "pending"],
        value: 50,
        weights: [10, 20, 10],
      }),
    ).toStrictEqual([1, 0.5, 0]);
  });

  it("fills a step that finished before the one beside it, which is still running", () => {
    // A lesson's mark (10) and draw (45) run side by side, and draw finished first.
    expect(
      getSegmentFills({
        statuses: ["completed", "completed", "active", "completed"],
        value: (135 / 145) * 100,
        weights: [40, 50, 10, 45],
      }),
    ).toStrictEqual([1, 1, 0, 1]);
  });

  it("keeps values outside 0 to 100 on the bar", () => {
    expect(
      getSegmentFills({ statuses: ["active", "pending"], value: -10, weights: [1, 1] }),
    ).toStrictEqual([0, 0]);

    expect(
      getSegmentFills({ statuses: ["completed", "active"], value: 140, weights: [1, 1] }),
    ).toStrictEqual([1, 1]);
  });

  it("leaves a bar without weight empty", () => {
    expect(
      getSegmentFills({ statuses: ["active", "pending"], value: 50, weights: [0, 0] }),
    ).toStrictEqual([0, 0]);

    expect(getSegmentFills({ statuses: [], value: 50, weights: [] })).toStrictEqual([]);
  });
});
