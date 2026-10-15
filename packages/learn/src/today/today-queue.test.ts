import { describe, expect, it } from "vitest";
import { isFinished, splitTodayQueue } from "./today-queue";

describe(splitTodayQueue, () => {
  it("keeps pending lessons before a later active block out of the done fold", () => {
    const blocks = [
      { position: 0, status: "completed" },
      { position: 1, status: "pending" },
      { position: 2, status: "pending" },
      { position: 3, status: "active" },
      { position: 4, status: "skipped" },
      { position: 5, status: "completed" },
      { position: 6, status: "pending" },
    ] as const;

    const queue = splitTodayQueue({ blocks, nextPosition: 3 });

    expect(queue.done.map((block) => block.position)).toStrictEqual([0, 4, 5]);
    expect(queue.before.map((block) => block.position)).toStrictEqual([1, 2]);
    expect(queue.after.map((block) => block.position)).toStrictEqual([6]);
  });

  it("keeps all unfinished blocks after the first next block", () => {
    const blocks = [
      { position: 0, status: "pending" },
      { position: 1, status: "pending" },
    ] as const;

    expect(splitTodayQueue({ blocks, nextPosition: 0 })).toStrictEqual({
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
