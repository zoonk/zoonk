import { describe, expect, it } from "vitest";
import { type UpNextCandidate, findUpNextItem } from "./up-next-item";

function lesson(id: string, status: "done" | "todo" = "todo"): UpNextCandidate {
  return { chapterId: `chapter-${id}`, id, kind: "lesson", lessonId: `lesson-${id}`, status };
}

describe(findUpNextItem, () => {
  // Pedro's Today opened a lesson of his plan's second phase while the Plan marked a chapter of
  // the first, the next one in plan order: every screen now reads the lesson Today opens.
  it("is the plan item of the lesson today's session opens next, though the plan teaches another first", () => {
    const items = [lesson("first"), lesson("ahead")];

    const next = findUpNextItem({
      items,
      todayBlocks: [{ lessonId: "lesson-ahead", planItemId: "ahead" }],
    });

    expect(next?.id).toBe("ahead");
  });

  it("goes on to today's next block once the first one's lesson is done elsewhere", () => {
    const items = [lesson("first"), lesson("studied", "done"), lesson("later")];

    const next = findUpNextItem({
      items,
      todayBlocks: [
        { lessonId: "lesson-studied", planItemId: "studied" },
        { lessonId: "lesson-later", planItemId: "later" },
      ],
    });

    expect(next?.id).toBe("later");
  });

  it("finds a block's plan item by its lesson when the block has none", () => {
    const items = [lesson("first"), lesson("ahead")];

    const next = findUpNextItem({
      items,
      todayBlocks: [{ lessonId: "lesson-ahead", planItemId: null }],
    });

    expect(next?.id).toBe("ahead");
  });

  it("is the plan's next lesson before today's session is built or once its lessons are done", () => {
    const items = [lesson("done", "done"), lesson("next"), lesson("after")];

    expect(findUpNextItem({ items, todayBlocks: [] })?.id).toBe("next");
  });

  it("is a lesson, never the challenge or the mock that comes first", () => {
    const challenge: UpNextCandidate = { ...lesson("challenge"), kind: "boss", lessonId: null };
    const mock: UpNextCandidate = { ...lesson("mock"), kind: "mock", lessonId: null };

    expect(findUpNextItem({ items: [challenge, mock, lesson("next")], todayBlocks: [] })?.id).toBe(
      "next",
    );
  });

  it("is nothing once every lesson is done", () => {
    expect(findUpNextItem({ items: [lesson("done", "done")], todayBlocks: [] })).toBeUndefined();
  });
});
