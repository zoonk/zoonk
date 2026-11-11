import { describe, expect, it } from "vitest";
import { getDayMeterParts } from "./day-meter-parts";
import { getSessionQueue } from "./session-queue-rows";
import { type DayStep } from "./session-types";

function step(position: number, status: DayStep["status"]): DayStep {
  return { estimatedMinutes: 5, kind: "learn", position, status } as DayStep;
}

describe(getDayMeterParts, () => {
  it("draws no part for a skipped block, as the session bar counts none", () => {
    const parts = getDayMeterParts({
      rows: getSessionQueue({
        blocks: [step(0, "completed"), step(1, "skipped"), step(2, "pending")],
        nextPosition: 2,
      }),
    });

    expect(parts.map((part) => [part.id, part.state])).toStrictEqual([
      [0, "done"],
      [2, "current"],
    ]);
  });

  it("fills only the next part as far as it's answered", () => {
    const parts = getDayMeterParts({
      nextShare: 0.5,
      rows: getSessionQueue({
        blocks: [step(0, "completed"), step(1, "active"), step(2, "pending")],
        nextPosition: 1,
      }),
    });

    expect(parts.map((part) => part.share)).toStrictEqual([0, 0.5, 0]);
  });
});
