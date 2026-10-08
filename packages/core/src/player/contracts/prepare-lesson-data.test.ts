import { shuffle } from "@zoonk/utils/shuffle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type TranslationOption,
  type WordBankOption,
  serializeExerciseSteps,
} from "./prepare-lesson-data";

vi.mock("@zoonk/utils/shuffle", () => ({ shuffle: vi.fn(<T>(items: T[]) => items) }));

type SerializeInput = Parameters<typeof serializeExerciseSteps>[0];
type Resources = SerializeInput["resources"];
type StepInput = SerializeInput["steps"][number];
type WordInput = NonNullable<StepInput["word"]>;
type SentenceInput = NonNullable<StepInput["sentence"]>;
type DistractorWordInput = Resources["distractorWords"][number];
const shuffleMock = vi.mocked(shuffle);

const alphabetContent = {
  audioText: "a",
  audioUrl: null,
  forms: [{ label: "Uppercase", symbol: "A" }],
  pronunciation: "ah",
  readingAid: "a",
  symbol: "a",
};

function makeWord(overrides: Partial<WordInput> = {}): WordInput {
  return {
    audioUrl: null,
    distractors: [],
    id: "1",
    pronunciation: null,
    romanization: null,
    translation: "translation",
    word: "word",
    ...overrides,
  };
}

function makeSentence(overrides: Partial<SentenceInput> = {}): SentenceInput {
  return {
    audioUrl: null,
    distractors: [],
    explanation: null,
    id: "1",
    romanization: null,
    sentence: "sentence",
    translation: "translation",
    translationDistractors: [],
    ...overrides,
  };
}

function makeDistractorWord(overrides: Partial<DistractorWordInput> = {}): DistractorWordInput {
  return { audioUrl: null, id: "1", romanization: null, word: "word", ...overrides };
}

function makeStep(overrides: Partial<StepInput> = {}): StepInput {
  return {
    content: alphabetContent,
    id: "1",
    kind: "alphabet",
    position: 0,
    sentence: null,
    word: null,
    ...overrides,
  };
}

function wordOption(word: string, metadata: Partial<WordBankOption> = {}): WordBankOption {
  return { audioUrl: null, romanization: null, translation: null, word, ...metadata };
}

function translationOption(
  option: Pick<TranslationOption, "id" | "word"> & Partial<TranslationOption>,
): TranslationOption {
  return { audioUrl: null, romanization: null, ...option };
}

function serialize({ steps, ...resources }: Partial<Resources> & { steps: StepInput[] }) {
  return serializeExerciseSteps({
    resources: {
      distractorWords: [],
      lessonSentences: [],
      lessonWords: [],
      sentenceWords: [],
      ...resources,
    },
    steps,
  });
}

function serializeTranslation(word: WordInput, distractorWords: DistractorWordInput[] = []) {
  return serialize({
    distractorWords,
    steps: [makeStep({ content: {}, id: "11", kind: "translation", word })],
  });
}

describe(serializeExerciseSteps, () => {
  beforeEach(() => {
    shuffleMock.mockReset();
    shuffleMock.mockImplementation(<T>(items: readonly T[]) => [...items]);
  });

  it("parses exercise content and filters steps that are not exercises", () => {
    const result = serialize({
      steps: [
        makeStep({ id: "42", position: 3 }),
        makeStep({
          content: { text: "Hello world", title: "Intro" },
          id: "2",
          kind: "explanation",
        }),
        makeStep({
          content: { text: "Hello", title: "Intro", variant: "text" },
          id: "3",
          kind: "static",
        }),
        makeStep({ id: "4", kind: "not-supported" }),
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "42", kind: "alphabet", position: 3 });
    expect(result[0]?.content).toStrictEqual(alphabetContent);
  });

  it("drops exercises whose content does not match the content contract", () => {
    const result = serialize({
      steps: [makeStep({ content: {}, id: "1" }), makeStep({ id: "2" })],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("2");
  });

  it("offers the serialized lesson words as every step's vocabulary", () => {
    const result = serialize({
      lessonWords: [
        makeWord({
          audioUrl: "/audio/boa-noite.mp3",
          distractors: ["boa tarde"],
          id: "10",
          pronunciation: "boa noite",
          translation: "good evening",
          word: "boa noite",
        }),
      ],
      steps: [makeStep()],
    });

    expect(result[0]?.vocabularyOptions).toStrictEqual([
      {
        audioUrl: "/audio/boa-noite.mp3",
        distractors: ["boa tarde"],
        id: "10",
        pronunciation: "boa noite",
        romanization: null,
        translation: "good evening",
        word: "boa noite",
      },
    ]);
  });

  it("populates fillBlankOptions and matchColumnsRightItems", () => {
    const result = serialize({
      steps: [
        makeStep({
          content: {
            answers: ["sky"],
            distractors: ["ground"],
            feedback: "The sky is blue",
            romanizations: { ground: "ground-rom" },
            template: "The ___ is blue",
          },
          id: "2",
          kind: "fillBlank",
        }),
        makeStep({
          content: {
            pairs: [
              { left: "A", right: "1" },
              { left: "B", right: "2" },
            ],
            question: "Match the pairs",
          },
          id: "3",
          kind: "matchColumns",
        }),
      ],
    });

    expect(result[0]?.fillBlankOptions).toStrictEqual([
      wordOption("sky"),
      // A word in Latin letters shows no romanization on its tile.
      wordOption("ground"),
    ]);

    expect(result[1]?.matchColumnsRightItems).toStrictEqual(["1", "2"]);
  });

  it("serializes the step word and sentence distractor arrays", () => {
    const word = makeWord({
      distractors: ["boa tarde", "bom dia"],
      id: "10",
      translation: "good evening",
      word: "boa noite",
    });

    const result = serialize({
      lessonWords: [word],
      steps: [
        makeStep({ content: {}, id: "11", kind: "translation", word }),
        makeStep({
          content: {},
          id: "12",
          kind: "reading",
          sentence: makeSentence({
            distractors: ["Abend", "Fenster"],
            id: "20",
            sentence: "Guten Morgen, Lara.",
            translation: "Bom dia, Lara.",
            translationDistractors: ["tchau", "logo"],
          }),
        }),
      ],
    });

    expect(result[0]?.vocabularyOptions[0]?.distractors).toStrictEqual(["boa tarde", "bom dia"]);
    expect(result[0]?.word?.distractors).toStrictEqual(["boa tarde", "bom dia"]);
    expect(result[1]?.sentence?.distractors).toStrictEqual(["Abend", "Fenster"]);
    expect(result[1]?.sentence?.translationDistractors).toStrictEqual(["tchau", "logo"]);
  });

  it("builds translation options from stored distractors and hydrated metadata", () => {
    const result = serializeTranslation(
      makeWord({
        distractors: ["boa tarde", "bom dia", "até logo"],
        id: "10",
        pronunciation: "boa noite",
        translation: "good evening",
        word: "boa noite",
      }),
      [
        makeDistractorWord({ audioUrl: "/audio/boa-tarde.mp3", id: "101", word: "boa tarde" }),
        makeDistractorWord({ audioUrl: "/audio/bom-dia.mp3", id: "102", word: "bom dia" }),
      ],
    );

    expect(result[0]?.translationOptions).toStrictEqual([
      translationOption({ id: "10", word: "Boa noite" }),
      translationOption({ audioUrl: "/audio/boa-tarde.mp3", id: "101", word: "Boa tarde" }),
      translationOption({ audioUrl: "/audio/bom-dia.mp3", id: "102", word: "Bom dia" }),
      translationOption({ id: "distractor:ate logo", word: "Até logo" }),
    ]);
  });

  it("capitalizes every translation option", () => {
    const result = serializeTranslation(
      makeWord({
        distractors: ["boa tarde", "boa noite"],
        translation: "Good morning",
        word: "Bom dia",
      }),
    );

    expect(result[0]?.translationOptions.map((option) => option.word)).toStrictEqual([
      "Bom dia",
      "Boa tarde",
      "Boa noite",
    ]);
  });

  it("capitalizes under-cased generated translation answers", () => {
    const result = serializeTranslation(
      makeWord({
        distractors: ["i'm busy", "i'm tired"],
        translation: "Estoy bien",
        word: "i'm fine",
      }),
    );

    expect(result[0]?.translationOptions.map((option) => option.word)).toStrictEqual([
      "I'm fine",
      "I'm busy",
      "I'm tired",
    ]);
  });

  it("adds the visible translation prompt punctuation to every translation option", () => {
    const result = serializeTranslation(
      makeWord({
        distractors: ["Boa tarde", "Boa noite."],
        translation: "Good morning!",
        word: "Bom dia",
      }),
    );

    expect(result[0]?.translationOptions.map((option) => option.word)).toStrictEqual([
      "Bom dia!",
      "Boa tarde!",
      "Boa noite!",
    ]);
  });

  it("strips terminal punctuation from translation options when the prompt has none", () => {
    const result = serializeTranslation(
      makeWord({
        distractors: ["Boa tarde.", "Boa noite!"],
        id: "10",
        translation: "Good morning",
        word: "Bom dia",
      }),
      [makeDistractorWord({ audioUrl: "/audio/boa-tarde.mp3", id: "101", word: "Boa tarde." })],
    );

    expect(result[0]?.translationOptions).toMatchObject([
      { id: "10", word: "Bom dia" },
      { audioUrl: "/audio/boa-tarde.mp3", id: "101", word: "Boa tarde" },
      { id: "distractor:boa noite", word: "Boa noite" },
    ]);
  });

  it("serializes multiple choice content", () => {
    const content = {
      options: [
        { feedback: "Yes", id: "alpha", isCorrect: true, text: "Alpha" },
        { feedback: "No", id: "beta", isCorrect: false, text: "Beta" },
      ],
      question: "Pick one",
    };

    const result = serialize({ steps: [makeStep({ content, id: "30", kind: "multipleChoice" })] });

    expect(result[0]?.content).toStrictEqual({
      options: [
        { feedback: "Yes", id: "alpha", isCorrect: true, text: "Alpha" },
        { feedback: "No", id: "beta", isCorrect: false, text: "Beta" },
      ],
      question: "Pick one",
    });
  });

  it("builds reading and listening word banks from stored distractors only", () => {
    const sentence = makeSentence({
      distractors: ["Abend", "Fenster", "Guten Tag"],
      id: "20",
      sentence: "Guten Morgen, Lara.",
      translation: "Bom dia, Lara.",
      translationDistractors: ["tchau", "boa noite"],
    });

    const result = serialize({
      distractorWords: [
        makeDistractorWord({
          audioUrl: "/audio/abend.mp3",
          id: "201",
          romanization: "abend",
          word: "Abend",
        }),
      ],
      steps: [
        makeStep({ content: {}, id: "12", kind: "reading", sentence }),
        makeStep({ content: {}, id: "13", kind: "listening", sentence }),
      ],
    });

    expect(result[0]?.wordBankOptions).toStrictEqual([
      wordOption("Guten"),
      wordOption("Morgen,"),
      wordOption("Lara."),
      wordOption("abend", { audioUrl: "/audio/abend.mp3" }),
      wordOption("fenster"),
    ]);

    expect(result[1]?.wordBankOptions).toStrictEqual([
      wordOption("Bom"),
      wordOption("dia,"),
      wordOption("Lara."),
      wordOption("tchau"),
    ]);
  });

  it("populates sentenceWordOptions from canonical sentence tokens", () => {
    const result = serialize({
      lessonWords: [
        makeWord({
          id: "10",
          romanization: "guten morgen",
          translation: "good morning",
          word: "Guten Morgen",
        }),
      ],
      steps: [
        makeStep({
          content: {},
          id: "12",
          kind: "reading",
          sentence: makeSentence({
            id: "20",
            sentence: "Guten Morgen",
            translation: "Good morning",
          }),
        }),
      ],
    });

    expect(result[0]?.sentenceWordOptions).toStrictEqual([
      wordOption("Guten"),
      wordOption("Morgen"),
    ]);
  });

  it("keeps sentence word metadata from sentence words when available", () => {
    const result = serialize({
      lessonWords: [
        makeWord({
          audioUrl: "/audio/lesson-gato.mp3",
          id: "10",
          translation: "cat (lesson)",
          word: "gato",
        }),
      ],
      sentenceWords: [
        makeWord({
          audioUrl: "/audio/sentence-gato.mp3",
          id: "11",
          romanization: "ga-to",
          translation: "cat (sentence)",
          word: "gato",
        }),
      ],
      steps: [
        makeStep({
          content: {},
          id: "40",
          kind: "reading",
          sentence: makeSentence({ id: "20", sentence: "gato bonito", translation: "pretty cat" }),
        }),
      ],
    });

    expect(result[0]?.sentenceWordOptions).toStrictEqual([
      wordOption("gato", { audioUrl: "/audio/sentence-gato.mp3", translation: "cat (lesson)" }),
      wordOption("bonito"),
    ]);
  });

  it("keeps sentenceWordOptions empty for steps without a sentence", () => {
    const result = serialize({ steps: [makeStep()] });

    expect(result[0]?.sentenceWordOptions).toStrictEqual([]);
  });

  it("keeps option helper arrays empty for unrelated step kinds", () => {
    const result = serialize({ steps: [makeStep()] });

    expect(result[0]).toMatchObject({
      fillBlankOptions: [],
      matchColumnsRightItems: [],
      sentenceWordOptions: [],
      translationOptions: [],
      vocabularyOptions: [],
      wordBankOptions: [],
    });
  });

  it("allows sanitation underflow without fallback top-up", () => {
    const result = serialize({
      steps: [
        makeStep({
          content: {},
          id: "12",
          kind: "reading",
          sentence: makeSentence({
            distractors: ["Hola", "Buenos dias"],
            id: "20",
            sentence: "Hola mundo",
            translation: "Hello world",
          }),
        }),
      ],
    });

    expect(result[0]?.wordBankOptions).toStrictEqual([wordOption("Hola"), wordOption("mundo")]);
  });
});
