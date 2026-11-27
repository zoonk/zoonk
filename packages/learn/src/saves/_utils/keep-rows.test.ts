import { describe, expect, it } from "vitest";
import { keepRows, shownRows } from "./keep-rows";

function keep({ kept, next, previous }: { kept: string[]; next: string[]; previous: string[] }) {
  return keepRows({ isKept: (row) => kept.includes(row), keyOf: (row) => row, next, previous });
}

describe(keepRows, () => {
  it("puts a removed row back after the row that was above it", () => {
    expect(keep({ kept: ["b"], next: ["a", "c"], previous: ["a", "b", "c"] })).toStrictEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps it under the same row when a row above that one vanished", () => {
    expect(keep({ kept: ["c"], next: ["b", "d"], previous: ["a", "b", "c", "d"] })).toStrictEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("puts it first when nothing above it is still listed", () => {
    expect(keep({ kept: ["b"], next: ["c"], previous: ["a", "b", "c"] })).toStrictEqual(["b", "c"]);
  });

  it("keeps removed rows next to each other in their order", () => {
    expect(
      keep({ kept: ["b", "c"], next: ["a", "d"], previous: ["a", "b", "c", "d"] }),
    ).toStrictEqual(["a", "b", "c", "d"]);
  });

  it("drops a row removed somewhere else", () => {
    expect(keep({ kept: [], next: ["a", "c"], previous: ["a", "b", "c"] })).toStrictEqual([
      "a",
      "c",
    ]);
  });
});

function shown({
  kept,
  removed,
  rows,
  served,
}: {
  kept: string[];
  removed: string[];
  rows: string[];
  served: string[];
}) {
  return shownRows({
    isKept: (row) => kept.includes(row),
    isSaved: (row) => !removed.includes(row),
    keyOf: (row) => row,
    rows,
    served,
  });
}

describe(shownRows, () => {
  it("shows a row removed on this visit", () => {
    expect(shown({ kept: ["b"], removed: ["b"], rows: ["a", "b"], served: ["a"] })).toStrictEqual([
      "a",
      "b",
    ]);
  });

  it("drops a row kept on an earlier visit once the list no longer has it", () => {
    expect(shown({ kept: [], removed: ["b"], rows: ["a", "b"], served: ["a"] })).toStrictEqual([
      "a",
    ]);
  });

  it("drops a row an older copy of the list still has after it was removed", () => {
    expect(shown({ kept: [], removed: ["b"], rows: ["a", "b"], served: ["a", "b"] })).toStrictEqual(
      ["a"],
    );
  });
});
