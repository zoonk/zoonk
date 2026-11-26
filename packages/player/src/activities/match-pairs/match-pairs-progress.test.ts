import { describe, expect, it } from "vitest";
import { boardFromAnswer, matchAnswer } from "./match-pairs-progress";

const card = (id: string) => ({ id, text: id, why: null });

const columns = { left: [card("a"), card("b")], right: [card("b"), card("a")] };

describe(matchAnswer, () => {
  it("keeps each left card's first try: its partner, or the first wrong one", () => {
    const misses = [
      { left: 1, right: 1 },
      { left: 1, right: 1 },
    ];

    expect(matchAnswer(columns, misses)).toStrictEqual({
      kind: "assignment",
      pairs: { a: "a", b: "a" },
    });
  });
});

describe(boardFromAnswer, () => {
  it("rebuilds the finished board, with each first wrong try as a miss", () => {
    expect(
      boardFromAnswer(columns, { kind: "assignment", pairs: { a: "a", b: "a" } }),
    ).toStrictEqual({ misses: [{ left: 1, right: 1 }], pairs: [1, 0] });
  });

  it("has no board before an answer", () => {
    expect(boardFromAnswer(columns, null)).toBeUndefined();
  });
});
