import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toBlockPayload } from "./block-payload";
import { getSessionMinutes } from "./session-minutes";

describe(getSessionMinutes, () => {
  it.each([
    { blocks: [], left: 240, reserved: true },
    { blocks: [{ estimatedMinutes: 235, status: "pending" }], left: 240, reserved: true },
    { blocks: [{ estimatedMinutes: 241, status: "pending" }], left: 241, reserved: false },
    {
      blocks: [
        { estimatedMinutes: 10, status: "skipped" },
        { estimatedMinutes: 10, status: "pending" },
      ],
      left: 240,
      reserved: false,
    },
    {
      blocks: [
        {
          estimatedMinutes: 10,
          payload: toBlockPayload({ creditedMinutes: 20 }),
          status: "completed",
        },
        { estimatedMinutes: 10, status: "active" },
      ],
      left: 220,
      reserved: false,
    },
    {
      blocks: [
        {
          estimatedMinutes: 10,
          payload: toBlockPayload({ creditedMinutes: 20 }),
          status: "completed",
        },
      ],
      left: 220,
      reserved: true,
    },
    { blocks: [{ estimatedMinutes: 10, status: "completed" }], left: 0, reserved: false },
  ])("returns $left with reservation $reserved and $blocks", ({ blocks, reserved, left }) => {
    expect(getSessionMinutes({ blocks, dailyGoal: 240, planned: 240, reserved }).left).toBe(left);
  });

  it("keeps the next block's estimate as the floor", () => {
    expect(
      getSessionMinutes({
        blocks: [
          { estimatedMinutes: 235, status: "completed" },
          { estimatedMinutes: 10, status: "pending" },
        ],
        dailyGoal: 240,
        planned: 240,
      }).left,
    ).toBe(10);
  });
});

describe("arbitrary day minutes", () => {
  it("keeps arbitrary days nonnegative, with no countdown after their last obligation", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            estimatedMinutes: fc.integer({ max: 1440, min: 0 }),
            status: fc.constantFrom("pending", "active", "completed", "skipped"),
          }),
        ),
        fc.integer({ max: 1440, min: 0 }),
        (blocks, planned) => {
          const minutes = getSessionMinutes({ blocks, dailyGoal: planned, planned });
          expect(minutes.left).toBeGreaterThanOrEqual(0);

          const next =
            blocks.find((block) => block.status === "active") ??
            blocks.find((block) => block.status === "pending");

          expect(next ? minutes.left >= next.estimatedMinutes : minutes.left === 0).toBe(true);
        },
      ),
    );
  });
});
