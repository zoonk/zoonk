import { describe, expect, test, vi } from "vitest";
import { buildSentenceWordOptions, buildWordBankOptions } from "./build-word-bank-options";
import { type SerializedStep, type SerializedWord } from "./prepare-activity-data";

vi.mock("@zoonk/utils/shuffle", () => ({
  shuffle: <T>(items: T[]) => items,
}));

function makeLessonWord(
  id: string,
  word: string,
  translation: string,
  alternativeTranslations: string[] = [],
): SerializedWord {
  return {
    alternativeTranslations,
    audioUrl: null,
    id,
    pronunciation: null,
    romanization: null,
    translation,
    word,
  };
}

function makeReadingStep(sentence: string): SerializedStep<"reading"> {
  return {
    content: {},
    fillBlankOptions: [],
    id: "step-reading",
    kind: "reading",
    matchColumnsRightItems: [],
    position: 0,
    sentence: {
      alternativeSentences: [],
      alternativeTranslations: [],
      audioUrl: null,
      explanation: null,
      id: "sentence-reading",
      romanization: null,
      sentence,
      translation: "unused",
    },
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  };
}

function makeListeningStep(translation: string): SerializedStep<"listening"> {
  return {
    content: {},
    fillBlankOptions: [],
    id: "step-listening",
    kind: "listening",
    matchColumnsRightItems: [],
    position: 0,
    sentence: {
      alternativeSentences: [],
      alternativeTranslations: [],
      audioUrl: null,
      explanation: null,
      id: "sentence-listening",
      romanization: null,
      sentence: "unused",
      translation,
    },
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  };
}

describe(buildWordBankOptions, () => {
  test("shows canonical reading words only while alternative sentences still suppress distractors", () => {
    const options = buildWordBankOptions(
      {
        ...makeReadingStep("Guten Morgen, Anna!"),
        sentence: {
          alternativeSentences: ["Guten Tag, Anna!"],
          alternativeTranslations: [],
          audioUrl: null,
          explanation: null,
          id: "sentence-reading",
          romanization: null,
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
        },
      },
      [
        makeLessonWord("1", "Guten Morgen", "Bom dia"),
        makeLessonWord("2", "Guten Tag", "Boa tarde", ["Bom dia"]),
        makeLessonWord("3", "Katze", "gato"),
      ],
      new Map(),
    );

    const words = options.map((option) => option.word);

    expect(words).toContain("Guten");
    expect(words).toContain("Morgen,");
    expect(words).not.toContain("Tag,");
    expect(words).toContain("Katze");
  });

  test("shows canonical listening words only while alternative translations still suppress distractors", () => {
    const options = buildWordBankOptions(
      {
        ...makeListeningStep("Boa tarde, senhor Weber."),
        sentence: {
          alternativeSentences: [],
          alternativeTranslations: ["Bom dia, senhor Weber."],
          audioUrl: null,
          explanation: null,
          id: "sentence-listening",
          romanization: null,
          sentence: "Guten Tag, Herr Weber.",
          translation: "Boa tarde, senhor Weber.",
        },
      },
      [
        makeLessonWord("1", "Guten Morgen", "Bom dia"),
        makeLessonWord("2", "Guten Tag", "Boa tarde", ["Bom dia"]),
        makeLessonWord("3", "Katze", "gato"),
      ],
      new Map(),
    );

    const words = options.map((option) => option.word);

    expect(words).toContain("Boa");
    expect(words).toContain("tarde,");
    expect(words).not.toContain("Bom");
    expect(words).not.toContain("dia");
    expect(words).toContain("gato");
  });

  test("filters reading distractors from semantically equivalent lesson words", () => {
    const options = buildWordBankOptions(
      makeReadingStep("Hallo, Lara!"),
      [
        makeLessonWord("1", "Hallo", "Olá", ["Oi"]),
        makeLessonWord("2", "Hi", "Oi", ["Olá"]),
        makeLessonWord("3", "Katze", "gato"),
      ],
      new Map(),
    );

    const words = options.map((option) => option.word);

    expect(words).not.toContain("Hi");
    expect(words).toContain("Katze");
  });

  test("filters reading distractor tokens from equivalent lesson phrases", () => {
    const options = buildWordBankOptions(
      makeReadingStep("Gute Nacht, Mama."),
      [
        makeLessonWord("1", "Gute Nacht", "Boa noite"),
        makeLessonWord("2", "Guten Abend", "Boa noite"),
        makeLessonWord("3", "Katze", "gato"),
      ],
      new Map(),
    );

    const words = options.map((option) => option.word);

    expect(words).not.toContain("Guten");
    expect(words).not.toContain("Abend");
    expect(words).toContain("Katze");
  });

  test("filters listening distractors from semantically equivalent lesson words", () => {
    const options = buildWordBankOptions(
      makeListeningStep("Olá, Lara!"),
      [
        makeLessonWord("1", "Hallo", "Olá", ["Oi"]),
        makeLessonWord("2", "Hi", "Oi", ["Olá"]),
        makeLessonWord("3", "Katze", "gato"),
      ],
      new Map(),
    );

    const words = options.map((option) => option.word);

    expect(words).not.toContain("Oi");
    expect(words).toContain("gato");
  });

  test("segments distractor phrases with the same tokenizer as correct options", () => {
    const options = buildWordBankOptions(
      makeReadingStep("猫です"),
      [makeLessonWord("1", "猫", "cat"), makeLessonWord("2", "犬です", "dog")],
      new Map(),
    );

    const words = options.map((option) => option.word);

    expect(words).toContain("犬");
    expect(words).not.toContain("犬です");
  });

  test("keeps standalone hyphenated distractor tokens intact", () => {
    const options = buildWordBankOptions(
      makeReadingStep("Hola mundo"),
      [makeLessonWord("1", "Hola", "hello"), makeLessonWord("2", "gato-prueba", "cat")],
      new Map(),
    );

    const words = options.map((option) => option.word);

    expect(words).toContain("gato-prueba");
    expect(words).not.toContain("gato");
    expect(words).not.toContain("prueba");
  });
});

describe(buildSentenceWordOptions, () => {
  test("prefers sentence metadata for tokens that include punctuation", () => {
    const options = buildSentenceWordOptions(
      "Guten Morgen!",
      [makeLessonWord("1", "Morgen", "morning (lesson)")],
      new Map([
        [
          "morgen",
          {
            romanization: "mor-gen",
            translation: "morning (sentence)",
            word: "morgen",
            wordAudio: { audioUrl: "https://example.com/morgen.mp3" },
          },
        ],
      ]),
    );

    expect(options[1]).toEqual({
      audioUrl: "https://example.com/morgen.mp3",
      romanization: "mor-gen",
      translation: "morning (sentence)",
      word: "Morgen!",
    });
  });
});
