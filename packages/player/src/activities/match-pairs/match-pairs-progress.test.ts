import { describe, expect, it } from "vitest";
import { matchAnswer, progressFromAnswer, recordTry } from "./match-pairs-progress";

const EMPTY = progressFromAnswer(null);

const card = (id: string, isTrap = false) => ({ id, isTrap, text: id, why: null });

describe(recordTry, () => {
  it("keeps each pair's first try and locks in matches", () => {
    const missed = recordTry(EMPTY, { left: card("a"), right: card("right-trap-0", true) });

    const matched = recordTry(missed, { left: card("a"), right: card("a") });

    expect(missed).toStrictEqual({ firstTries: { a: "right-trap-0" }, matched: [] });
    expect(matched).toStrictEqual({ firstTries: { a: "right-trap-0" }, matched: ["a"] });
  });

  it("doesn't count tries from a trap on the left", () => {
    expect(recordTry(EMPTY, { left: card("left-trap-0", true), right: card("a") })).toStrictEqual(
      EMPTY,
    );
  });
});

describe(matchAnswer, () => {
  it("answers once every pair is matched, with the first tries", () => {
    const partial = recordTry(EMPTY, { left: card("a"), right: card("a") });
    const missed = recordTry(partial, { left: card("b"), right: card("a") });
    const done = recordTry(missed, { left: card("b"), right: card("b") });

    expect(matchAnswer(["a", "b"], partial)).toBeNull();

    expect(matchAnswer(["a", "b"], done)).toStrictEqual({
      kind: "assignment",
      pairs: { a: "a", b: "a" },
    });
  });
});
