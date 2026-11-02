import { describe, expect, it } from "vitest";
import { splitEvenly } from "./split-evenly";

describe(splitEvenly, () => {
  it("splits into the fewest chunks of at most the size, their sizes at most one apart", () => {
    expect(splitEvenly({ items: [1, 2, 3, 4, 5], size: 2 })).toStrictEqual([[1], [2, 3], [4, 5]]);

    expect(splitEvenly({ items: [1, 2, 3, 4], size: 2 })).toStrictEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("has no chunks for no items", () => {
    expect(splitEvenly({ items: [], size: 3 })).toStrictEqual([]);
  });
});
