import { describe, expect, test } from "vitest";
import { mergeSearchResults } from "./search";

type TestItem = { id: string; title: string };

describe(mergeSearchResults, () => {
  test("returns exact match first when it exists", () => {
    const exactMatch: TestItem = { id: "1", title: "Law" };
    const containsMatches: TestItem[] = [
      { id: "2", title: "Criminal Law" },
      { id: "3", title: "Tax Law" },
    ];

    const result = mergeSearchResults(exactMatch, containsMatches);

    expect(result[0]).toEqual(exactMatch);
    expect(result).toHaveLength(3);
  });

  test("returns contains matches unchanged when no exact match", () => {
    const containsMatches: TestItem[] = [
      { id: "2", title: "Criminal Law" },
      { id: "3", title: "Tax Law" },
    ];

    const result = mergeSearchResults(null, containsMatches);

    expect(result).toEqual(containsMatches);
  });

  test("removes duplicate from contains matches when exact match exists", () => {
    const exactMatch: TestItem = { id: "1", title: "Law" };
    const containsMatches: TestItem[] = [
      { id: "1", title: "Law" },
      { id: "2", title: "Criminal Law" },
      { id: "3", title: "Tax Law" },
    ];

    const result = mergeSearchResults(exactMatch, containsMatches);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(exactMatch);
    expect(result.filter((item) => item.id === "1")).toHaveLength(1);
  });

  test("returns just exact match when contains is empty", () => {
    const exactMatch: TestItem = { id: "1", title: "Law" };

    const result = mergeSearchResults(exactMatch, []);

    expect(result).toEqual([exactMatch]);
  });

  test("returns empty array when both inputs are empty", () => {
    const result = mergeSearchResults(null, []);

    expect(result).toEqual([]);
  });

  test("preserves order of contains matches after exact match", () => {
    const exactMatch: TestItem = { id: "1", title: "Law" };
    const containsMatches: TestItem[] = [
      { id: "2", title: "Criminal Law" },
      { id: "3", title: "Tax Law" },
      { id: "4", title: "Civil Law" },
    ];

    const result = mergeSearchResults(exactMatch, containsMatches);

    expect(result).toHaveLength(4);
    expect(result.map((item) => item.id)).toEqual(["1", "2", "3", "4"]);
  });
});
