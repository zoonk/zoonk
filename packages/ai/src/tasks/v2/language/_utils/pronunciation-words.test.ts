import { describe, expect, it } from "vitest";
import { splitExpectedWords, toPronouncedWords } from "./pronunciation-words";

describe(splitExpectedWords, () => {
  it("keeps words as written and drops stray punctuation", () => {
    expect(splitExpectedWords("  ¿Dónde  está - el teléfono? ")).toStrictEqual([
      "¿Dónde",
      "está",
      "el",
      "teléfono?",
    ]);
  });
});

describe(toPronouncedWords, () => {
  const expectedWords = ["The", "ship", "is", "big"];

  it("puts verdicts back on the expected words by number and cleans their fields", () => {
    expect(
      toPronouncedWords({
        expectedWords,
        verdicts: [
          { heard: "the", issue: "sound", number: 1, status: "correct" },
          { heard: " sheep ", issue: "sound", number: 2, status: "different" },
          { heard: "is", issue: null, number: 3, status: "missed" },
          { heard: null, issue: null, number: 4, status: "correct" },
        ],
      }),
    ).toStrictEqual([
      { heard: null, issue: null, status: "correct", text: "The" },
      { heard: "sheep", issue: "sound", status: "different", text: "ship" },
      { heard: null, issue: null, status: "missed", text: "is" },
      { heard: null, issue: null, status: "correct", text: "big" },
    ]);
  });

  it("counts skipped words and unexplained differences as said right", () => {
    expect(
      toPronouncedWords({
        expectedWords,
        verdicts: [
          { heard: "  ", issue: "stress", number: 2, status: "different" },
          { heard: "extra", issue: null, number: 9, status: "different" },
        ],
      }).map((word) => word.status),
    ).toStrictEqual(["correct", "correct", "correct", "correct"]);
  });
});
