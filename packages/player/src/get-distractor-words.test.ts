import { describe, expect, test } from "vitest";
import { getDistractorWords } from "./get-distractor-words";

function makeWord(
  id: string,
  translation: string,
  alternativeTranslations: string[] = [],
  word = `word-${id}`,
) {
  return { alternativeTranslations, id, translation, word };
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

  test("uses fallback words when lesson words cannot reach the requested count", () => {
    const correct = makeWord("1", "hello", ["hi"], "hola");
    const words = [correct, makeWord("2", "hi", [], "oi"), makeWord("3", "cat", [], "gato")];
    const fallbackWords = [makeWord("4", "dog", [], "perro"), makeWord("5", "bird", [], "pajaro")];
    const result = getDistractorWords(correct, words, 3, fallbackWords);

    expect(result).toHaveLength(3);
    expect(result.map((word) => word.id).toSorted()).toEqual(["3", "4", "5"]);
  });

  test("keeps only safe distractors when fallback words still cannot satisfy the count", () => {
    const correct = makeWord("1", "hello", ["hi"], "hola");
    const words = [correct, makeWord("2", "cat", [], "gato")];
    const fallbackWords = [makeWord("3", "hi", [], "oi"), makeWord("4", "dog", [], "perro")];
    const result = getDistractorWords(correct, words, 3, fallbackWords);

    expect(result).toHaveLength(2);
    expect(result.map((word) => word.id).toSorted()).toEqual(["2", "4"]);
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

  test("excludes distractors whose word text matches the correct word after stripping punctuation", () => {
    const correct = makeWord("1", "how are you", [], "ça va ?");
    const words = [correct, makeWord("2", "fine", [], "ça va."), makeWord("3", "cat", [], "chat")];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("3");
  });

  test("deduplicates distractors that have the same normalized word text", () => {
    const correct = makeWord("1", "hello", [], "bonjour");
    const words = [
      correct,
      makeWord("2", "fine", [], "ça va."),
      makeWord("3", "how are you", [], "ça va?"),
      makeWord("4", "cat", [], "chat"),
    ];
    const result = getDistractorWords(correct, words, 5);

    expect(result).toHaveLength(2);

    const ids = result.map((word) => word.id);
    expect(ids).toContain("4");
    // Exactly one of the two punctuation variants survives (which one depends on shuffle)
    expect(ids.filter((id) => id === "2" || id === "3")).toHaveLength(1);
  });
});
