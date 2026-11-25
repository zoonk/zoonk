import { describe, expect, it } from "vitest";
import { getAlternativeStudyBlockPosition } from "./alternative-study-block";

describe(getAlternativeStudyBlockPosition, () => {
  it("skips the next stop, a preparing mock, and a writing block unavailable until tomorrow", () => {
    const available = { preparing: false, status: "pending", waitReason: null } as const;

    expect(
      getAlternativeStudyBlockPosition({
        blocks: [
          { ...available, kind: "review", position: 0 },
          { ...available, kind: "checkpoint", position: 1, preparing: true },
          {
            ...available,
            kind: "produce",
            position: 2,
            writingAvailability: { returnsOn: "2026-10-01", status: "tomorrow" },
          },
          { ...available, kind: "learn", position: 3 },
          { ...available, kind: "practice", position: 4 },
        ],
        nextPosition: 0,
      }),
    ).toBe(4);
  });
});
