import { describe, expect, test, vi } from "vitest";
import { buildSentenceWordOptions, buildWordBankOptions } from "./build-word-bank-options";
import {
  type SerializedSentence,
  type SerializedStep,
  type SerializedWord,
} from "./prepare-activity-data";
import { type DistractorWord } from "./translation-options";

vi.mock("@zoonk/utils/shuffle", () => ({
  shuffle: <T>(items: T[]) => items,
}));

function makeLessonWord(overrides: Partial<SerializedWord> = {}): SerializedWord {
  return {
    audioUrl: null,
    distractors: [],
    id: "lesson-word",
    pronunciation: null,
    romanization: null,
    translation: "translation",
    word: "word",
    ...overrides,
  };
}

function makeSentence(overrides: Partial<SerializedSentence> = {}): SerializedSentence {
  return {
    audioUrl: null,
    distractors: [],
    explanation: null,
    id: "sentence-1",
    romanization: null,
    sentence: "Guten Morgen, Anna!",
    translation: "Bom dia, Anna!",
    translationDistractors: [],
    ...overrides,
  };
}

function makeStep(
  kind: "reading" | "listening",
  sentence: SerializedSentence,
): SerializedStep<"reading" | "listening"> {
  return {
    content: {},
    fillBlankOptions: [],
    id: `step-${kind}`,
    kind,
    matchColumnsRightItems: [],
    position: 0,
    sentence,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  };
}

function makeDistractorWord(overrides: Partial<DistractorWord> = {}): DistractorWord {
  return {
    audioUrl: null,
    id: "distractor-1",
    pronunciation: null,
    romanization: null,
    word: "word",
    ...overrides,
  };
}

describe(buildWordBankOptions, () => {
  test("reading uses stored distractors only and removes phrases plus canonical collisions", () => {
    const options = buildWordBankOptions(
      makeStep(
        "reading",
        makeSentence({
          distractors: ["Abend", "Guten", "Guten Tag", "Fenster"],
          sentence: "Guten Morgen, Anna!",
        }),
      ),
      [],
      [],
      new Map(),
    );

    expect(options.map((option) => option.word)).toEqual([
      "Guten",
      "Morgen,",
      "Anna!",
      "Abend",
      "Fenster",
    ]);
  });

  test("reading hydrates target-language distractors with metadata", () => {
    const options = buildWordBankOptions(
      makeStep(
        "reading",
        makeSentence({
          distractors: ["犬"],
          sentence: "猫です",
        }),
      ),
      [],
      [
        makeDistractorWord({
          audioUrl: "/audio/dog.mp3",
          id: "dog-1",
          romanization: "inu",
          word: "犬",
        }),
      ],
      new Map(),
    );

    expect(options.find((option) => option.word === "犬")).toEqual({
      audioUrl: "/audio/dog.mp3",
      romanization: "inu",
      translation: null,
      word: "犬",
    });
  });

  test("listening uses translation distractors and keeps metadata empty", () => {
    const options = buildWordBankOptions(
      makeStep(
        "listening",
        makeSentence({
          sentence: "Guten Tag, Lara.",
          translation: "Boa tarde, Lara.",
          translationDistractors: ["Bom", "noite", "cedo demais"],
        }),
      ),
      [
        makeLessonWord({
          audioUrl: "/audio/bom.mp3",
          romanization: "bom",
          translation: "good",
          word: "Bom",
        }),
      ],
      [
        makeDistractorWord({
          audioUrl: "/audio/noite.mp3",
          romanization: "noite",
          word: "noite",
        }),
      ],
      new Map(),
    );

    expect(options.map((option) => option.word)).toEqual([
      "Boa",
      "tarde,",
      "Lara.",
      "Bom",
      "noite",
    ]);
    expect(options.find((option) => option.word === "noite")).toEqual({
      audioUrl: null,
      romanization: null,
      translation: null,
      word: "noite",
    });
  });

  test("shows fewer distractors when sanitation removes entries", () => {
    const options = buildWordBankOptions(
      makeStep(
        "reading",
        makeSentence({
          distractors: ["Hola", "Salut"],
          sentence: "Hola mundo",
        }),
      ),
      [],
      [],
      new Map(),
    );

    expect(options.map((option) => option.word)).toEqual(["Hola", "mundo", "Salut"]);
  });
});

describe(buildSentenceWordOptions, () => {
  test("hydrates multi-word lesson entries token by token", () => {
    const options = buildSentenceWordOptions(
      "Guten Morgen",
      [
        makeLessonWord({
          romanization: "guten morgen",
          word: "Guten Morgen",
        }),
      ],
      [],
      new Map(),
    );

    expect(options).toEqual([
      {
        audioUrl: null,
        romanization: "guten",
        translation: null,
        word: "Guten",
      },
      {
        audioUrl: null,
        romanization: "morgen",
        translation: null,
        word: "Morgen",
      },
    ]);
  });

  test("keeps lesson-word translations when sentence metadata adds audio and romanization", () => {
    const options = buildSentenceWordOptions(
      "Hola",
      [
        makeLessonWord({
          audioUrl: "/audio/hola.mp3",
          romanization: null,
          translation: "hello",
          word: "Hola",
        }),
      ],
      [],
      new Map([
        [
          "hola",
          {
            audioUrl: "/audio/hola-sentence.mp3",
            romanization: "o-la",
            word: "Hola",
          },
        ],
      ]),
    );

    expect(options).toEqual([
      {
        audioUrl: "/audio/hola-sentence.mp3",
        romanization: "o-la",
        translation: "hello",
        word: "Hola",
      },
    ]);
  });
});
