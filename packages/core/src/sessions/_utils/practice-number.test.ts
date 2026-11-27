import { describe, expect, it } from "vitest";
import { getPracticeNumber } from "./practice-number";

type Block = Parameters<typeof getPracticeNumber>[0]["block"];

function practice(position: number, payload: Record<string, unknown> = {}): Block {
  return {
    kind: "practice",
    payload: { itemIds: ["item"], ...payload },
    position,
    status: "pending",
  };
}

const lesson: Block = { kind: "learn", payload: {}, position: 0, status: "pending" };

describe(getPracticeNumber, () => {
  it("leaves the day's only practice unnumbered", () => {
    const only = practice(1);

    expect(getPracticeNumber({ block: only, blocks: [lesson, only] })).toBeNull();
  });

  it("numbers a day's practices in the order the day lists them", () => {
    const blocks = [lesson, practice(1), practice(2), practice(3, { extra: true })];

    expect(blocks.map((block) => getPracticeNumber({ block, blocks }))).toStrictEqual([
      null,
      1,
      2,
      3,
    ]);
  });

  it("counts a finished practice before the ones still to do", () => {
    const later = practice(1);
    const finished = { ...practice(2), status: "completed" as const };
    const blocks = [lesson, later, finished];

    expect(getPracticeNumber({ block: finished, blocks })).toBe(1);
    expect(getPracticeNumber({ block: later, blocks })).toBe(2);
  });

  it("leaves out practices that have names of their own and skipped ones", () => {
    const mistakes = practice(1, { itemIds: [] });
    const everyTopic = practice(2, { fullReview: true });
    const subject = practice(3, { title: "Chapter 2" });
    const skipped = { ...practice(4), status: "skipped" as const };
    const plain = practice(5);
    const blocks = [mistakes, everyTopic, subject, skipped, plain];

    expect(blocks.map((block) => getPracticeNumber({ block, blocks }))).toStrictEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
