import { describe, expect, it } from "vitest";
import { getNextBlock } from "./day-blocks";

describe(getNextBlock, () => {
  it("moves past a preparing mock and writing that returns tomorrow", () => {
    const mock = { position: 0, preparing: true, status: "pending" };
    const writing = { position: 1, status: "pending", writingAvailability: { status: "tomorrow" } };
    const lesson = { position: 2, status: "pending" };

    expect(getNextBlock([mock, writing, lesson])).toBe(lesson);
    expect(getNextBlock([mock, writing])).toBeUndefined();
  });

  it("continues active writing when the next start is limited", () => {
    const lesson = { position: 0, status: "pending" };
    const writing = { position: 1, status: "active", writingAvailability: { status: "tomorrow" } };

    expect(getNextBlock([lesson, writing])).toBe(writing);
  });
});
