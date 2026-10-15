import { describe, expect, it } from "vitest";
import { getSessionQueue } from "./session-queue-rows";
import { type DayStep, type StudyBlock } from "./session-types";

function block(id: string, status: StudyBlock["status"], estimatedMinutes: number): StudyBlock {
  return { estimatedMinutes, id, status } as StudyBlock;
}

/** A step of a day not opened yet: no id, only its place in the day. */
function step(
  position: number,
  estimatedMinutes: number,
  status: DayStep["status"] = "pending",
): DayStep {
  return { estimatedMinutes, position, status } as DayStep;
}

describe(getSessionQueue, () => {
  it("marks the finished blocks done, the next one, and counts the minutes left", () => {
    const queue = getSessionQueue({
      blocks: [
        block("review", "completed", 8),
        block("lesson", "pending", 12),
        block("practice", "pending", 10),
      ],
      nextId: "lesson",
    });

    expect(queue.rows.map((row) => ["id" in row.block && row.block.id, row.state])).toStrictEqual([
      ["review", "done"],
      ["lesson", "next"],
      ["practice", "ahead"],
    ]);

    expect(queue.minutesLeft).toBe(22);
  });

  it("counts a block that just ended as done, even while the session still has it running", () => {
    const queue = getSessionQueue({
      blocks: [block("review", "active", 8), block("lesson", "pending", 12)],
      finishedId: "review",
      nextId: "lesson",
    });

    expect(queue.rows.map((row) => row.state)).toStrictEqual(["done", "next"]);
    expect(queue.minutesLeft).toBe(12);
  });

  it("leaves skipped blocks out of the day", () => {
    const queue = getSessionQueue({
      blocks: [block("review", "skipped", 8), block("lesson", "active", 12)],
      nextId: "lesson",
    });

    expect(queue.rows.map((row) => "id" in row.block && row.block.id)).toStrictEqual(["lesson"]);
    expect(queue.minutesLeft).toBe(12);
  });

  it("names the next step by its place in a day not opened yet", () => {
    const queue = getSessionQueue({
      blocks: [step(0, 8), step(1, 12), step(2, 10)],
      nextPosition: 1,
    });

    expect(queue.rows.map((row) => row.state)).toStrictEqual(["ahead", "next", "ahead"]);
    expect(queue.minutesLeft).toBe(30);
  });

  it("keeps the work done earlier as done in a day still to open", () => {
    const queue = getSessionQueue({
      blocks: [step(0, 8, "completed"), step(1, 12), step(2, 10)],
      nextPosition: 1,
    });

    expect(queue.rows.map((row) => row.state)).toStrictEqual(["done", "next", "ahead"]);
    expect(queue.minutesLeft).toBe(22);
  });
});
