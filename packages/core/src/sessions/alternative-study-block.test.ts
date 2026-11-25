import { describe, expect, it } from "vitest";
import { getAlternativeStudyBlockPosition } from "./alternative-study-block";

describe(getAlternativeStudyBlockPosition, () => {
  const available = { preparing: false, status: "pending", waitReason: null } as const;

  it("skips lessons, a preparing mock, and a writing block unavailable until tomorrow", () => {
    expect(
      getAlternativeStudyBlockPosition([
        { ...available, kind: "learn", position: 0 },
        { ...available, kind: "checkpoint", position: 1, preparing: true },
        {
          ...available,
          kind: "produce",
          position: 2,
          writingAvailability: { returnsOn: "2026-10-01", status: "tomorrow" },
        },
        { ...available, kind: "learn", position: 3 },
        { ...available, kind: "practice", position: 4 },
      ]),
    ).toBe(4);
  });

  it("offers the day's next review to a later lesson the learner opened", () => {
    expect(
      getAlternativeStudyBlockPosition([
        { ...available, kind: "review", position: 0 },
        { ...available, kind: "learn", position: 1 },
        { ...available, kind: "practice", position: 2 },
      ]),
    ).toBe(0);
  });
});
