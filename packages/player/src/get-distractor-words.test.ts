import { describe, expect, test } from "vitest";
import { getDistractorWords } from "./get-distractor-words";

function makeWord(id: string, translation: string, alternativeTranslations: string[] = []) {
  return { alternativeTranslations, id, translation };
}

describe(getDistractorWords, () => {
  test("excludes the correct word itself", () => {
    const correct = makeWord("1", "hello");
    const words = [correct, makeWord("2", "cat"), makeWord("3", "dog")];
    const result = getDistractorWords(correct, words, 5);

    expect(result.every((word) => word.id !== "1")).toBeTruthy();
  });

  test("excludes words with the same translation", () => {
    const correct = makeWord("1", "good evening");
    const words = [correct, makeWord("2", "good evening"), makeWord("3", "cat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  test("excludes words with the same translation case-insensitively", () => {
    const correct = makeWord("1", "Good Evening");
    const words = [correct, makeWord("2", "good evening"), makeWord("3", "cat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  test("excludes words whose translation matches an alternative translation of the correct word", () => {
    const correct = makeWord("1", "good evening", ["good night"]);
    const words = [correct, makeWord("2", "good night"), makeWord("3", "cat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  test("bidirectional: excludes words whose alternativeTranslations contain the correct word's translation", () => {
    const correct = makeWord("1", "hi");
    const words = [correct, makeWord("2", "hello", ["hi", "hey"]), makeWord("3", "cat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  test("combines all rules: same translation + alternative translations", () => {
    const correct = makeWord("1", "hello", ["hi"]);
    const words = [
      correct,
      makeWord("2", "hello"),
      makeWord("3", "hi"),
      makeWord("4", "hey", ["hello"]),
      makeWord("5", "cat"),
    ];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("5");
  });

  test("returns at most count distractors", () => {
    const correct = makeWord("1", "hello");
    const words = [
      correct,
      makeWord("2", "cat"),
      makeWord("3", "dog"),
      makeWord("4", "bird"),
      makeWord("5", "fish"),
    ];
    const result = getDistractorWords(correct, words, 2);

    expect(result).toHaveLength(2);
  });

  test("returns fewer than count when not enough valid distractors exist", () => {
    const correct = makeWord("1", "hello", ["hi"]);
    const words = [correct, makeWord("2", "hi")];
    const result = getDistractorWords(correct, words, 3);

    expect(result).toHaveLength(0);
  });

  test("returns empty array when all words are alternatives", () => {
    const correct = makeWord("1", "hello", ["hi", "hey"]);
    const words = [correct, makeWord("2", "hello"), makeWord("3", "hi"), makeWord("4", "hey")];
    const result = getDistractorWords(correct, words, 3);

    expect(result).toHaveLength(0);
  });

  test("works correctly when alternativeTranslations is empty", () => {
    const correct = makeWord("1", "good evening");
    const words = [correct, makeWord("2", "good evening"), makeWord("3", "cat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  test("shuffles the result", () => {
    const correct = makeWord("1", "target");
    const words = [
      correct,
      ...Array.from({ length: 20 }, (_, index) =>
        makeWord(String(index + 2), `word-${String(index)}`),
      ),
    ];

    const results = Array.from({ length: 10 }, () =>
      getDistractorWords(correct, words, 10).map((word) => word.id),
    );

    const allSame = results.every(
      (result) => JSON.stringify(result) === JSON.stringify(results[0]),
    );

    expect(allSame).toBeFalsy();
  });

  test("excludes words whose alternativeTranslations overlap with correct word's alternatives", () => {
    const correct = makeWord("1", "farewell", ["bye", "goodbye"]);
    const words = [correct, makeWord("2", "see you", ["bye", "later"]), makeWord("3", "cat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  test("alternative-to-alternative overlap is case-insensitive", () => {
    const correct = makeWord("1", "farewell", ["BYE"]);
    const words = [correct, makeWord("2", "see you", ["bye"]), makeWord("3", "cat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  test("alternative translation matching is case-insensitive", () => {
    const correct = makeWord("1", "Good Evening", ["GOOD NIGHT"]);
    const words = [correct, makeWord("2", "good night"), makeWord("3", "cat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });
});
