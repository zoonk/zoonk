import { describe, expect, it } from "vitest";
import { type MockCandidate } from "./mock-plan";
import { takeQuestions } from "./mock-sets";

function single(itemId: string): MockCandidate {
  return { answered: false, area: null, difficulty: null, itemId, skillId: "skill" };
}

/** A question in one of the exam's formats. */
function of(format: string, itemId: string): MockCandidate {
  return { ...single(itemId), format };
}

/** A set's questions, each with its place in the set. */
function setOf(setId: string, itemIds: string[]): MockCandidate[] {
  return itemIds.map((itemId, position) => ({
    ...single(itemId),
    set: { id: setId, position, size: itemIds.length },
  }));
}

describe(takeQuestions, () => {
  it("asks a set whole, its questions together in the set's order, wherever its first one comes", () => {
    const [first, second, third] = setOf("text", ["t1", "t2", "t3"]);
    const pool = [single("a"), third!, single("b"), first!, second!, single("c")];

    expect(takeQuestions({ pool, wanted: 5 })).toStrictEqual(["a", "t1", "t2", "t3", "b"]);
  });

  it("leaves out a set the section has no room for, and one missing some of its questions", () => {
    const pool = [...setOf("long", ["l1", "l2", "l3"]), ...setOf("cut", ["c1", "c2"]).slice(1)];

    expect(takeQuestions({ pool: [single("a"), ...pool, single("b")], wanted: 3 })).toStrictEqual([
      "a",
      "b",
    ]);
  });

  it("asks each format its share, format by format, and fills a short format's room with others", () => {
    const pool = [
      of("choice", "c1"),
      of("choice", "c2"),
      of("choice", "c3"),
      of("numeric", "n1"),
      of("choice", "c4"),
      of("picks", "p1"),
    ];

    const quotas = new Map([
      ["choice", 2],
      ["picks", 2],
      ["numeric", 2],
    ]);

    // Picks and numeric have one question each for their two places, so the next choice question
    // takes the room left.
    expect(takeQuestions({ pool, quotas, wanted: 5 })).toStrictEqual([
      "c1",
      "c2",
      "c3",
      "p1",
      "n1",
    ]);
  });
});
