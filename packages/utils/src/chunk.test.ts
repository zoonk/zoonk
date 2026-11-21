import { describe, expect, it } from "vitest";
import { chunk } from "./chunk";

describe(chunk, () => {
  it("splits items into groups of the size, the last one holding what's left", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toStrictEqual([]);
  });
});
