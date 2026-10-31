import { describe, expect, it } from "vitest";
import { interleave, interleaveByWeight } from "./interleave";

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

describe(interleaveByWeight, () => {
  it("matches interleave when every group weighs the same", () => {
    const groups = [["a1", "a2", "a3"], ["b1"], [], ["c1", "c2"]];

    expect(interleaveByWeight(groups.map((items) => ({ items, weight: 0.3 })))).toStrictEqual(
      interleave(groups),
    );
  });

  it("starts with every group once, then gives each turns in proportion to its weight", () => {
    const picked = interleaveByWeight([
      { items: ["a1", "a2", "a3", "a4", "a5", "a6", "a7"], weight: 3 },
      { items: ["b1", "b2", "b3", "b4", "b5", "b6", "b7"], weight: 1 },
    ]);

    expect(picked.slice(0, 2)).toStrictEqual(["a1", "b1"]);
    expect(picked.slice(0, 8).filter((item) => item.startsWith("a"))).toHaveLength(6);
  });

  it("leaves a group weighing nothing for after the others run out", () => {
    expect(
      interleaveByWeight([
        { items: ["a1", "a2", "a3"], weight: 0 },
        { items: ["b1", "b2"], weight: 1 },
      ]),
    ).toStrictEqual(["a1", "b1", "b2", "a2", "a3"]);
  });
});
