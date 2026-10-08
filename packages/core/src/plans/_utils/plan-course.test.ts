import { describe, expect, it } from "vitest";
import { isPlanFinished } from "./plan-course";

describe(isPlanFinished, () => {
  it("is finished once every lesson is behind the learner, even with a final checkpoint ahead", () => {
    expect(
      isPlanFinished([
        { kind: "lesson", status: "done" },
        { kind: "chapter", status: "testedOut" },
        { kind: "boss", status: "todo" },
      ]),
    ).toBe(true);
  });

  it("isn't finished while a mock or a review before the exam is still ahead", () => {
    expect(
      isPlanFinished([
        { kind: "lesson", status: "testedOut" },
        { kind: "lesson", status: "testedOut" },
        { kind: "mock", status: "todo" },
      ]),
    ).toBe(false);

    expect(
      isPlanFinished([
        { kind: "lesson", status: "done" },
        { kind: "mock", status: "done" },
        { kind: "review", status: "todo" },
      ]),
    ).toBe(false);

    expect(
      isPlanFinished([
        { kind: "lesson", status: "done" },
        { kind: "mock", status: "done" },
        { kind: "review", status: "done" },
      ]),
    ).toBe(true);
  });

  it("isn't finished with a lesson left or without lessons", () => {
    expect(isPlanFinished([{ kind: "lesson", status: "todo" }])).toBe(false);
    expect(isPlanFinished([{ kind: "mock", status: "done" }])).toBe(false);
  });
});
