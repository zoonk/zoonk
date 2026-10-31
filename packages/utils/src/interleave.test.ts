import { describe, expect, it } from "vitest";
import { interleave } from "./interleave";

describe(interleave, () => {
  it("takes one element from each group in turn until every group runs out", () => {
    expect(interleave([["a1", "a2", "a3"], ["b1"], [], ["c1", "c2"]])).toStrictEqual([
      "a1",
      "b1",
      "c1",
      "a2",
      "c2",
      "a3",
    ]);
  });

  it("returns nothing for no groups", () => {
    expect(interleave([])).toStrictEqual([]);
  });
});
