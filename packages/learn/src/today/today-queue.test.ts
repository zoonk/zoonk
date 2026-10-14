import { describe, expect, it } from "vitest";
import { isFinished, splitTodayQueue } from "./today-queue";

describe(splitTodayQueue, () => {
  it("keeps pending lessons before a later active block out of the done fold", () => {
    const blocks = [
      { id: "review", status: "completed" },
      { id: "lesson-one", status: "pending" },
      { id: "lesson-two", status: "pending" },
      { id: "practice", status: "active" },
      { id: "skipped", status: "skipped" },
      { id: "later-review", status: "completed" },
      { id: "later-lesson", status: "pending" },
    ] as const;

    const queue = splitTodayQueue({ blocks, nextId: "practice" });

    expect(queue.done.map((block) => block.id)).toStrictEqual([
      "review",
      "skipped",
      "later-review",
    ]);

    expect(queue.before.map((block) => block.id)).toStrictEqual(["lesson-one", "lesson-two"]);
    expect(queue.after.map((block) => block.id)).toStrictEqual(["later-lesson"]);
  });

  it("keeps all unfinished blocks after the first next block", () => {
    const blocks = [
      { id: "next", status: "pending" },
      { id: "later", status: "pending" },
    ] as const;

    expect(splitTodayQueue({ blocks, nextId: "next" })).toStrictEqual({
      after: [blocks[1]],
      before: [],
      done: [],
    });
  });
});

describe(isFinished, () => {
  it.each(["completed", "skipped"] as const)("counts %s as finished", (status) => {
    expect(isFinished({ status })).toBe(true);
  });

  it.each(["active", "pending"] as const)("keeps %s outstanding", (status) => {
    expect(isFinished({ status })).toBe(false);
  });
});
