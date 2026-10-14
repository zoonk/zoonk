import { describe, expect, it } from "vitest";
import { getSessionQueue } from "./session-queue-rows";
import { type StudyBlock } from "./session-types";

function block(id: string, status: StudyBlock["status"], estimatedMinutes: number): StudyBlock {
  return { estimatedMinutes, id, status } as StudyBlock;
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

    expect(queue.rows.map((row) => [row.block.id, row.state])).toStrictEqual([
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

    expect(queue.rows.map((row) => row.block.id)).toStrictEqual(["lesson"]);
    expect(queue.minutesLeft).toBe(12);
  });
});
