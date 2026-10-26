import { describe, expect, it } from "vitest";
import { matchAnswer, progressFromAnswer, recordTry } from "./match-pairs-progress";

const EMPTY = progressFromAnswer(null);

const card = (id: string) => ({ id, text: id, why: null });

describe(recordTry, () => {
  it("keeps each pair's first try and locks in matches", () => {
    const missed = recordTry(EMPTY, { left: card("a"), right: card("b") });

    const matched = recordTry(missed, { left: card("a"), right: card("a") });

    expect(missed).toStrictEqual({ firstTries: { a: "b" }, matched: [] });
    expect(matched).toStrictEqual({ firstTries: { a: "b" }, matched: ["a"] });
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
