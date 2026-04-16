import { describe, expect, test } from "vitest";
import {
  attachTranslationsToSteps,
  toDistractorWordInputs,
  toLessonSentenceInputs,
  toLessonWordInputs,
  toSentenceWordInputs,
} from "./activity-data-mappers";

function makeLessonWord(overrides: Record<string, unknown> = {}) {
  return {
    distractors: [],
    translation: "translation",
    word: {
      audioUrl: null,
      id: "1",
      pronunciations: [],
      romanization: null,
      word: "word",
    },
    ...overrides,
  };
}

function makeLessonSentence(overrides: Record<string, unknown> = {}) {
  return {
    distractors: [],
    explanation: null,
    sentence: {
      audioUrl: null,
      id: "1",
      romanization: null,
      sentence: "sentence",
    },
    translation: "translation",
    translationDistractors: [],
    ...overrides,
  };
}

describe(toLessonWordInputs, () => {
  test("maps lesson words to player inputs", () => {
    const result = toLessonWordInputs([
      makeLessonWord({
        distractors: ["boa tarde"],
        translation: "good evening",
        word: {
          audioUrl: "/audio/boa-noite.mp3",
          id: "1",
          pronunciations: [{ pronunciation: "boa noite" }],
          romanization: null,
          word: "boa noite",
        },
      }),
    ]);

    expect(result).toEqual([
      {
        audioUrl: "/audio/boa-noite.mp3",
        distractors: ["boa tarde"],
        id: "1",
        pronunciation: "boa noite",
        romanization: null,
        translation: "good evening",
        word: "boa noite",
      },
    ]);
  });
});

describe(toLessonSentenceInputs, () => {
  test("maps lesson sentences to player inputs", () => {
    const result = toLessonSentenceInputs([
      makeLessonSentence({
        distractors: ["abend"],
        explanation: "Greeting sentence",
        sentence: {
          audioUrl: "/audio/sentence.mp3",
          id: "2",
          romanization: null,
          sentence: "Guten Morgen",
        },
        translation: "Good morning",
        translationDistractors: ["hello"],
      }),
    ]);

    expect(result).toEqual([
      {
        audioUrl: "/audio/sentence.mp3",
        distractors: ["abend"],
        explanation: "Greeting sentence",
        id: "2",
        romanization: null,
        sentence: "Guten Morgen",
        translation: "Good morning",
        translationDistractors: ["hello"],
      },
    ]);
  });
});

describe(toSentenceWordInputs, () => {
  test("reuses lesson word mapping for canonical sentence words", () => {
    const result = toSentenceWordInputs([
      makeLessonWord({
        translation: "cat",
        word: {
          audioUrl: null,
          id: "3",
          pronunciations: [{ pronunciation: "katze" }],
          romanization: null,
          word: "Katze",
        },
      }),
    ]);

    expect(result[0]).toMatchObject({
      pronunciation: "katze",
      translation: "cat",
      word: "Katze",
    });
  });
});

describe(toDistractorWordInputs, () => {
  test("keeps only lightweight distractor metadata", () => {
    const result = toDistractorWordInputs([
      {
        audioUrl: "/audio/abend.mp3",
        id: "4",
        pronunciations: [{ pronunciation: "abend" }],
        romanization: null,
        word: "Abend",
      },
    ]);

    expect(result).toEqual([
      {
        audioUrl: "/audio/abend.mp3",
        id: "4",
        pronunciation: "abend",
        romanization: null,
        word: "Abend",
      },
    ]);
  });
});

describe(attachTranslationsToSteps, () => {
  test("merges lesson-scoped translations and distractors into raw steps", () => {
    const result = attachTranslationsToSteps(
      [
        {
          content: {},
          id: "1",
          kind: "translation",
          position: 0,
          sentence: null,
          word: {
            audioUrl: "/audio/boa-noite.mp3",
            id: "1",
            romanization: null,
            word: "boa noite",
          },
        },
        {
          content: {},
          id: "2",
          kind: "reading",
          position: 1,
          sentence: {
            audioUrl: "/audio/sentence.mp3",
            id: "2",
            romanization: null,
            sentence: "Guten Morgen",
          },
          word: null,
        },
      ],
      [
        makeLessonWord({
          distractors: ["boa tarde"],
          translation: "good evening",
          word: {
            audioUrl: "/audio/boa-noite.mp3",
            id: "1",
            pronunciations: [{ pronunciation: "boa noite" }],
            romanization: null,
            word: "boa noite",
          },
        }),
      ],
      [
        makeLessonSentence({
          distractors: ["abend"],
          explanation: "Greeting sentence",
          sentence: {
            audioUrl: "/audio/sentence.mp3",
            id: "2",
            romanization: null,
            sentence: "Guten Morgen",
          },
          translation: "Good morning",
          translationDistractors: ["hello"],
        }),
      ],
    );

    expect(result).toEqual([
      {
        content: {},
        id: "1",
        kind: "translation",
        position: 0,
        sentence: null,
        word: {
          audioUrl: "/audio/boa-noite.mp3",
          distractors: ["boa tarde"],
          id: "1",
          pronunciation: "boa noite",
          romanization: null,
          translation: "good evening",
          word: "boa noite",
        },
      },
      {
        content: {},
        id: "2",
        kind: "reading",
        position: 1,
        sentence: {
          audioUrl: "/audio/sentence.mp3",
          distractors: ["abend"],
          explanation: "Greeting sentence",
          id: "2",
          romanization: null,
          sentence: "Guten Morgen",
          translation: "Good morning",
          translationDistractors: ["hello"],
        },
        word: null,
      },
    ]);
  });

  test("falls back to empty lesson-scoped data when no matching lesson row exists", () => {
    const result = attachTranslationsToSteps(
      [
        {
          content: {},
          id: "1",
          kind: "translation",
          position: 0,
          sentence: null,
          word: {
            audioUrl: null,
            id: "1",
            romanization: null,
            word: "hola",
          },
        },
        {
          content: {},
          id: "2",
          kind: "reading",
          position: 1,
          sentence: {
            audioUrl: null,
            id: "2",
            romanization: null,
            sentence: "hola mundo",
          },
          word: null,
        },
      ],
      [],
      [],
    );

    expect(result).toEqual([
      {
        content: {},
        id: "1",
        kind: "translation",
        position: 0,
        sentence: null,
        word: {
          audioUrl: null,
          distractors: [],
          id: "1",
          pronunciation: null,
          romanization: null,
          translation: "",
          word: "hola",
        },
      },
      {
        content: {},
        id: "2",
        kind: "reading",
        position: 1,
        sentence: {
          audioUrl: null,
          distractors: [],
          explanation: null,
          id: "2",
          romanization: null,
          sentence: "hola mundo",
          translation: "",
          translationDistractors: [],
        },
        word: null,
      },
    ]);
  });
});
