import { describe, expect, it } from "vitest";
import { getPracticeNumber } from "./practice-number";

type Block = Parameters<typeof getPracticeNumber>[0]["block"] & {
  status: "active" | "completed" | "pending" | "skipped";
};

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

  it("keeps each practice's number whatever the learner opens, finishes or skips first", () => {
    const first = practice(1);
    const second = practice(2);
    const blocks = [lesson, first, second];

    const opened = [
      lesson,
      { ...first, status: "skipped" as const },
      { ...second, status: "active" as const },
    ];

    expect(blocks.map((block) => getPracticeNumber({ block, blocks }))).toStrictEqual(
      opened.map((block) => getPracticeNumber({ block, blocks: opened })),
    );
  });

  it("leaves out practices that have names of their own", () => {
    const mistakes = practice(1, { itemIds: [] });
    const everyTopic = practice(2, { fullReview: true });
    const subject = practice(3, { title: "Chapter 2" });
    const plain = practice(4);
    const blocks = [mistakes, everyTopic, subject, plain];

    expect(blocks.map((block) => getPracticeNumber({ block, blocks }))).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});
