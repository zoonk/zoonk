import { describe, expect, it, vi } from "vitest";
import { buildSentenceWordOptions, buildWordBankOptions } from "./build-word-bank-options";
import { type SerializedStep, type SerializedWord } from "./prepare-lesson-data";
import { type DistractorWord } from "./translation-options";

type SerializedSentence = NonNullable<SerializedStep["sentence"]>;

const shuffleMock = vi.hoisted(() => vi.fn((items: readonly unknown[]) => [...items]));

vi.mock("@zoonk/utils/shuffle", () => ({ shuffle: shuffleMock }));

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
  it("reading uses stored distractors only and removes phrases plus canonical collisions", () => {
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

    expect(options.map((option) => option.word)).toStrictEqual([
      "Guten",
      "Morgen,",
      "Anna!",
      "abend",
      "fenster",
    ]);
  });

  it("reading hydrates target-language distractors with metadata", () => {
    const options = buildWordBankOptions(
      makeStep("reading", makeSentence({ distractors: ["犬"], sentence: "猫です" })),
      [],
      [
        makeDistractorWord({
          audioUrl: "/audio/dog.mp3",
          id: "dog-1",
          pronunciation: "EE-noo",
          romanization: "inu",
          word: "犬",
        }),
      ],
      new Map(),
    );

    expect(options.find((option) => option.word === "犬")).toStrictEqual({
      audioUrl: "/audio/dog.mp3",
      pronunciation: "EE-noo",
      romanization: "inu",
      translation: null,
      word: "犬",
    });
  });

  it("listening uses translation distractors and keeps metadata empty", () => {
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
      [makeDistractorWord({ audioUrl: "/audio/noite.mp3", romanization: "noite", word: "noite" })],
      new Map(),
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "Boa",
      "tarde,",
      "Lara.",
      "bom",
      "noite",
    ]);

    expect(options.find((option) => option.word === "noite")).toStrictEqual({
      audioUrl: null,
      pronunciation: null,
      romanization: null,
      translation: null,
      word: "noite",
    });
  });

  it("limits reading word banks to four distractors", () => {
    const options = buildWordBankOptions(
      makeStep(
        "reading",
        makeSentence({
          distractors: ["uno", "dos", "tres", "cuatro", "cinco"],
          sentence: "Hola mundo",
        }),
      ),
      [],
      [],
      new Map(),
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "Hola",
      "mundo",
      "uno",
      "dos",
      "tres",
      "cuatro",
    ]);
  });

  it("shuffles reading distractors before applying the visible cap", () => {
    shuffleMock
      .mockImplementationOnce((items: readonly unknown[]) => [...items].toReversed())
      .mockImplementationOnce((items: readonly unknown[]) => [...items]);

    const options = buildWordBankOptions(
      makeStep(
        "reading",
        makeSentence({
          distractors: ["uno", "dos", "tres", "cuatro", "cinco"],
          sentence: "Hola mundo",
        }),
      ),
      [],
      [],
      new Map(),
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "Hola",
      "mundo",
      "cinco",
      "cuatro",
      "tres",
      "dos",
    ]);
  });

  it("lowercases listening distractors before display", () => {
    const options = buildWordBankOptions(
      makeStep(
        "listening",
        makeSentence({
          sentence: "Como você está?",
          translation: "Hi, how are you?",
          translationDistractors: ["Farewell", "Thanks", "Goodbye", "Please"],
        }),
      ),
      [],
      [],
      new Map(),
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "Hi,",
      "how",
      "are",
      "you?",
      "farewell",
      "thanks",
      "goodbye",
      "please",
    ]);
  });

  it("shows fewer distractors when sanitation removes entries", () => {
    const options = buildWordBankOptions(
      makeStep("reading", makeSentence({ distractors: ["Hola", "Salut"], sentence: "Hola mundo" })),
      [],
      [],
      new Map(),
    );

    expect(options.map((option) => option.word)).toStrictEqual(["Hola", "mundo", "salut"]);
  });
});

describe(buildSentenceWordOptions, () => {
  it("hydrates multi-word lesson entries token by token", () => {
    const options = buildSentenceWordOptions(
      "Guten Morgen",
      [makeLessonWord({ romanization: "guten morgen", word: "Guten Morgen" })],
      [],
      new Map(),
    );

    expect(options).toStrictEqual([
      {
        audioUrl: null,
        pronunciation: null,
        romanization: "guten",
        translation: null,
        word: "Guten",
      },
      {
        audioUrl: null,
        pronunciation: null,
        romanization: "morgen",
        translation: null,
        word: "Morgen",
      },
    ]);
  });

  it("keeps lesson-word translations when sentence metadata adds audio and romanization", () => {
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
            pronunciation: "OH-lah",
            romanization: "o-la",
            word: "Hola",
          },
        ],
      ]),
    );

    expect(options).toStrictEqual([
      {
        audioUrl: "/audio/hola-sentence.mp3",
        pronunciation: "OH-lah",
        romanization: "o-la",
        translation: "hello",
        word: "Hola",
      },
    ]);
  });
});
