import { describe, expect, test } from "vitest";
import {
  buildAcceptedArrangeWordSequences,
  getAcceptedArrangeWordLengths,
  matchesAcceptedArrangeWords,
} from "./arrange-words-answers";

describe(buildAcceptedArrangeWordSequences, () => {
  test("ignores blank alternatives and deduplicates equivalent sequences", () => {
    const acceptedSequences = buildAcceptedArrangeWordSequences("Hallo, Lara!", [
      "hallo lara",
      "   ",
      "!!!",
      "Hallo, Lara!",
    ]);

    expect(acceptedSequences).toEqual([["Hallo,", "Lara!"]]);
  });
});

describe(getAcceptedArrangeWordLengths, () => {
  test("returns unique sorted non-empty lengths", () => {
    const lengths = getAcceptedArrangeWordLengths([[], ["one"], ["a", "b"], ["x", "y"]]);

    expect(lengths).toEqual([1, 2]);
  });
});

describe(matchesAcceptedArrangeWords, () => {
  test("matches user answers with the same normalized sequence key", () => {
    const acceptedSequences = [["Hallo,", "Lara!"]];

    expect(matchesAcceptedArrangeWords(acceptedSequences, ["hallo", "lara"])).toBe(true);
    expect(matchesAcceptedArrangeWords(acceptedSequences, ["lara", "hallo"])).toBe(false);
  });
});
