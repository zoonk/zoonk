import { describe, expect, test, vi } from "vitest";
import { prepareLessonActivityData } from "./prepare-activity-data";

vi.mock("@zoonk/utils/shuffle", () => ({
  shuffle: <T>(items: T[]) => items,
}));

type PrepareLessonActivityInput = Parameters<typeof prepareLessonActivityData>[0];
type ActivityInput = PrepareLessonActivityInput["activity"];
type RawStep = ActivityInput["steps"][number];
type RawStepWord = NonNullable<RawStep["word"]>;
type RawStepSentence = NonNullable<RawStep["sentence"]>;
type LessonWord = PrepareLessonActivityInput["lessonWords"][number];
type LessonSentence = PrepareLessonActivityInput["lessonSentences"][number];
type SentenceWord = NonNullable<PrepareLessonActivityInput["sentenceWords"]>[number];
type DistractorWord = NonNullable<PrepareLessonActivityInput["distractorWords"]>[number];

function makeWordRecord(overrides: Partial<LessonWord["word"]> = {}): LessonWord["word"] {
  return {
    audioUrl: null,
    id: 1n,
    pronunciations: [],
    romanization: null,
    word: "word",
    ...overrides,
  };
}

function makeSentenceRecord(
  overrides: Partial<LessonSentence["sentence"]> = {},
): LessonSentence["sentence"] {
  return {
    audioUrl: null,
    id: 1n,
    romanization: null,
    sentence: "sentence",
    ...overrides,
  };
}

function makeStepWord(overrides: Partial<RawStepWord> = {}): RawStepWord {
  return {
    audioUrl: null,
    id: 1n,
    romanization: null,
    word: "word",
    ...overrides,
  };
}

function makeStepSentence(overrides: Partial<RawStepSentence> = {}): RawStepSentence {
  return {
    audioUrl: null,
    id: 1n,
    romanization: null,
    sentence: "sentence",
    ...overrides,
  };
}

function makeLessonWord(overrides: Partial<LessonWord> = {}): LessonWord {
  const word = overrides.word ?? makeWordRecord();

  return {
    distractors: [],
    translation: "translation",
    word,
    ...overrides,
  };
}

function makeLessonSentence(overrides: Partial<LessonSentence> = {}): LessonSentence {
  const sentence = overrides.sentence ?? makeSentenceRecord();

  return {
    distractors: [],
    explanation: null,
    sentence,
    translation: "translation",
    translationDistractors: [],
    ...overrides,
  };
}

function makeSentenceWord(overrides: Partial<SentenceWord> = {}): SentenceWord {
  const word = overrides.word ?? makeWordRecord();

  return {
    distractors: [],
    translation: "translation",
    word,
    ...overrides,
  };
}

function makeDistractorWord(overrides: Partial<DistractorWord> = {}): DistractorWord {
  return {
    audioUrl: null,
    id: 1n,
    pronunciations: [],
    romanization: null,
    word: "word",
    ...overrides,
  };
}

function makeStep(overrides: Partial<RawStep> = {}): RawStep {
  return {
    content: {},
    id: 1n,
    kind: "static",
    position: 0,
    sentence: null,
    word: null,
    ...overrides,
  };
}

function makeActivity(steps: RawStep[], overrides: Partial<ActivityInput> = {}): ActivityInput {
  return {
    description: null,
    id: 1n,
    kind: "lesson",
    language: "en",
    organizationId: 1,
    steps,
    title: "Activity",
    ...overrides,
  };
}

function prepare(params: Partial<PrepareLessonActivityInput> = {}) {
  return prepareLessonActivityData({
    activity: params.activity ?? makeActivity([]),
    distractorWords: params.distractorWords,
    lessonSentences: params.lessonSentences ?? [],
    lessonWords: params.lessonWords ?? [],
    sentenceWords: params.sentenceWords,
    steps: params.steps,
  });
}

describe(prepareLessonActivityData, () => {
  test("serializes activity and step ids to strings", () => {
    const result = prepare({
      activity: makeActivity(
        [
          makeStep({
            content: { text: "Hello world", title: "Intro", variant: "text" },
            id: 42n,
          }),
        ],
        { id: 99n },
      ),
    });

    expect(result.id).toBe("99");
    expect(result.steps[0]?.id).toBe("42");
  });

  test("keeps activity metadata plus serialized lesson pools", () => {
    const word = makeLessonWord({
      distractors: ["boa tarde"],
      translation: "good evening",
      word: makeWordRecord({
        audioUrl: "/audio/boa-noite.mp3",
        id: 10n,
        pronunciations: [{ pronunciation: "boa noite" }],
        word: "boa noite",
      }),
    });
    const sentence = makeLessonSentence({
      distractors: ["Abend"],
      explanation: "Greeting",
      sentence: makeSentenceRecord({
        audioUrl: "/audio/guten-morgen.mp3",
        id: 20n,
        romanization: "guten morgen",
        sentence: "Guten Morgen",
      }),
      translation: "Good morning",
      translationDistractors: ["Hello"],
    });

    const result = prepare({
      activity: makeActivity(
        [makeStep({ content: { text: "Hello world", title: "Intro", variant: "text" } })],
        {
          description: "Description",
          id: 99n,
          kind: "review",
          organizationId: 42,
        },
      ),
      lessonSentences: [sentence],
      lessonWords: [word],
    });

    expect(result).toMatchObject({
      description: "Description",
      kind: "review",
      language: "en",
      organizationId: 42,
      title: "Activity",
    });
    expect(result.lessonWords).toEqual([
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
    expect(result.lessonSentences).toEqual([
      {
        audioUrl: "/audio/guten-morgen.mp3",
        distractors: ["Abend"],
        explanation: "Greeting",
        id: "20",
        romanization: "guten morgen",
        sentence: "Guten Morgen",
        translation: "Good morning",
        translationDistractors: ["Hello"],
      },
    ]);
  });

  test("parses supported step content and filters unsupported steps", () => {
    const result = prepare({
      activity: makeActivity([
        makeStep({
          content: { text: "Hello world", title: "Intro", variant: "text" },
          kind: "static",
        }),
        makeStep({ id: 2n, kind: "not-supported" }),
      ]),
    });

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.content).toEqual({
      text: "Hello world",
      title: "Intro",
      variant: "text",
    });
  });

  test("populates sortOrderItems, fillBlankOptions, and matchColumnsRightItems", () => {
    const result = prepare({
      activity: makeActivity([
        makeStep({
          content: {
            feedback: "Correct order",
            items: ["first", "second", "third"],
            question: "Sort these",
          },
          id: 1n,
          kind: "sortOrder",
        }),
        makeStep({
          content: {
            answers: ["sky"],
            distractors: ["ground"],
            feedback: "The sky is blue",
            romanizations: { ground: "ground-rom" },
            template: "The ___ is blue",
          },
          id: 2n,
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
          id: 3n,
          kind: "matchColumns",
        }),
      ]),
    });

    expect(result.steps[0]?.sortOrderItems).toEqual(["first", "second", "third"]);
    expect(result.steps[1]?.fillBlankOptions).toEqual([
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "sky",
      },
      {
        audioUrl: null,
        romanization: "ground-rom",
        translation: null,
        word: "ground",
      },
    ]);
    expect(result.steps[2]?.matchColumnsRightItems).toEqual(["1", "2"]);
  });

  test("serializes lesson-scoped distractor arrays for words and sentences", () => {
    const word = makeLessonWord({
      distractors: ["boa tarde", "bom dia"],
      translation: "good evening",
      word: makeWordRecord({ id: 10n, word: "boa noite" }),
    });
    const sentence = makeLessonSentence({
      distractors: ["Abend", "Fenster"],
      sentence: makeSentenceRecord({ id: 20n, sentence: "Guten Morgen, Lara." }),
      translation: "Bom dia, Lara.",
      translationDistractors: ["tchau", "logo"],
    });

    const result = prepare({
      activity: makeActivity([
        makeStep({
          id: 11n,
          kind: "translation",
          word: makeStepWord({ id: 10n, word: "boa noite" }),
        }),
        makeStep({
          id: 12n,
          kind: "reading",
          sentence: makeStepSentence({ id: 20n, sentence: "Guten Morgen, Lara." }),
        }),
      ]),
      lessonSentences: [sentence],
      lessonWords: [word],
    });

    expect(result.lessonWords[0]?.distractors).toEqual(["boa tarde", "bom dia"]);
    expect(result.lessonSentences[0]?.distractors).toEqual(["Abend", "Fenster"]);
    expect(result.lessonSentences[0]?.translationDistractors).toEqual(["tchau", "logo"]);
    expect(result.steps[0]?.word?.distractors).toEqual(["boa tarde", "bom dia"]);
    expect(result.steps[1]?.sentence?.distractors).toEqual(["Abend", "Fenster"]);
  });

  test("builds translation options from stored distractors and hydrated metadata", () => {
    const word = makeLessonWord({
      distractors: ["boa tarde", "bom dia", "até logo"],
      translation: "good evening",
      word: makeWordRecord({
        id: 10n,
        pronunciations: [{ pronunciation: "boa noite" }],
        word: "boa noite",
      }),
    });

    const result = prepare({
      activity: makeActivity([
        makeStep({
          id: 11n,
          kind: "translation",
          word: makeStepWord({ id: 10n, word: "boa noite" }),
        }),
      ]),
      distractorWords: [
        makeDistractorWord({
          audioUrl: "/audio/boa-tarde.mp3",
          id: 101n,
          pronunciations: [{ pronunciation: "boa tarde" }],
          word: "boa tarde",
        }),
        makeDistractorWord({
          audioUrl: "/audio/bom-dia.mp3",
          id: 102n,
          pronunciations: [{ pronunciation: "bom dia" }],
          word: "bom dia",
        }),
      ],
      lessonWords: [word],
    });

    expect(result.steps[0]?.translationOptions).toEqual([
      {
        audioUrl: null,
        id: "10",
        pronunciation: "boa noite",
        romanization: null,
        word: "boa noite",
      },
      {
        audioUrl: "/audio/boa-tarde.mp3",
        id: "101",
        pronunciation: "boa tarde",
        romanization: null,
        word: "boa tarde",
      },
      {
        audioUrl: "/audio/bom-dia.mp3",
        id: "102",
        pronunciation: "bom dia",
        romanization: null,
        word: "bom dia",
      },
      {
        audioUrl: null,
        id: "distractor:ate logo",
        pronunciation: null,
        romanization: null,
        word: "até logo",
      },
    ]);
  });

  test("drops supported steps whose content does not match the content contract", () => {
    const result = prepare({
      activity: makeActivity([
        makeStep({ content: {}, id: 1n, kind: "static" }),
        makeStep({
          content: { text: "Hello world", title: "Intro", variant: "text" },
          id: 2n,
          kind: "static",
        }),
      ]),
    });

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.id).toBe("2");
  });

  test("serializes multiple choice core content", () => {
    const result = prepare({
      activity: makeActivity([
        makeStep({
          content: {
            kind: "core",
            options: [
              { feedback: "Yes", isCorrect: true, text: "Alpha" },
              { feedback: "No", isCorrect: false, text: "Beta" },
            ],
            question: "Pick one",
          },
          id: 30n,
          kind: "multipleChoice",
        }),
      ]),
    });

    expect(result.steps[0]?.content).toEqual({
      kind: "core",
      options: [
        { feedback: "Yes", isCorrect: true, text: "Alpha" },
        { feedback: "No", isCorrect: false, text: "Beta" },
      ],
      question: "Pick one",
    });
  });

  test("builds reading and listening word banks from stored distractors only", () => {
    const sentence = makeLessonSentence({
      distractors: ["Abend", "Fenster", "Guten Tag"],
      sentence: makeSentenceRecord({ id: 20n, sentence: "Guten Morgen, Lara." }),
      translation: "Bom dia, Lara.",
      translationDistractors: ["tchau", "boa noite"],
    });

    const result = prepare({
      activity: makeActivity([
        makeStep({
          id: 12n,
          kind: "reading",
          sentence: makeStepSentence({ id: 20n, sentence: "Guten Morgen, Lara." }),
        }),
        makeStep({
          id: 13n,
          kind: "listening",
          sentence: makeStepSentence({ id: 20n, sentence: "Guten Morgen, Lara." }),
        }),
      ]),
      distractorWords: [
        makeDistractorWord({
          audioUrl: "/audio/abend.mp3",
          id: 201n,
          pronunciations: [{ pronunciation: "abend" }],
          romanization: "abend",
          word: "Abend",
        }),
      ],
      lessonSentences: [sentence],
    });

    expect(result.steps[0]?.wordBankOptions).toEqual([
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "Guten",
      },
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "Morgen,",
      },
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "Lara.",
      },
      {
        audioUrl: "/audio/abend.mp3",
        romanization: "abend",
        translation: null,
        word: "Abend",
      },
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "Fenster",
      },
    ]);

    expect(result.steps[1]?.wordBankOptions).toEqual([
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "Bom",
      },
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "dia,",
      },
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "Lara.",
      },
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "tchau",
      },
    ]);
  });

  test("populates sentenceWordOptions from canonical sentence tokens", () => {
    const sentence = makeLessonSentence({
      sentence: makeSentenceRecord({ id: 20n, sentence: "Guten Morgen" }),
      translation: "Good morning",
    });

    const result = prepare({
      activity: makeActivity([
        makeStep({
          id: 12n,
          kind: "reading",
          sentence: makeStepSentence({ id: 20n, sentence: "Guten Morgen" }),
        }),
      ]),
      lessonSentences: [sentence],
      lessonWords: [
        makeLessonWord({
          translation: "good morning",
          word: makeWordRecord({
            id: 10n,
            romanization: "guten morgen",
            word: "Guten Morgen",
          }),
        }),
      ],
    });

    expect(result.steps[0]?.sentenceWordOptions).toEqual([
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

  test("keeps sentence word metadata from sentence words when available", () => {
    const sentence = makeLessonSentence({
      sentence: makeSentenceRecord({ id: 20n, sentence: "gato bonito" }),
      translation: "pretty cat",
    });

    const result = prepare({
      activity: makeActivity([
        makeStep({
          id: 40n,
          kind: "reading",
          sentence: makeStepSentence({ id: 20n, sentence: "gato bonito" }),
        }),
      ]),
      lessonSentences: [sentence],
      lessonWords: [
        makeLessonWord({
          translation: "cat (lesson)",
          word: makeWordRecord({
            audioUrl: "/audio/lesson-gato.mp3",
            id: 10n,
            word: "gato",
          }),
        }),
      ],
      sentenceWords: [
        makeSentenceWord({
          translation: "cat (sentence)",
          word: makeWordRecord({
            audioUrl: "/audio/sentence-gato.mp3",
            id: 11n,
            romanization: "ga-to",
            word: "gato",
          }),
        }),
      ],
    });

    expect(result.steps[0]?.sentenceWordOptions).toEqual([
      {
        audioUrl: "/audio/sentence-gato.mp3",
        romanization: "ga-to",
        translation: "cat (lesson)",
        word: "gato",
      },
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "bonito",
      },
    ]);
  });

  test("keeps sentenceWordOptions empty for steps without a sentence", () => {
    const result = prepare({
      activity: makeActivity([
        makeStep({
          content: { text: "Hello world", title: "Intro", variant: "text" },
          kind: "static",
        }),
      ]),
    });

    expect(result.steps[0]?.sentenceWordOptions).toEqual([]);
  });

  test("keeps option helper arrays empty for unrelated step kinds", () => {
    const result = prepare({
      activity: makeActivity([
        makeStep({
          content: { text: "Hello world", title: "Intro", variant: "text" },
          kind: "static",
        }),
      ]),
    });

    expect(result.steps[0]).toMatchObject({
      fillBlankOptions: [],
      matchColumnsRightItems: [],
      sentenceWordOptions: [],
      sortOrderItems: [],
      translationOptions: [],
      vocabularyOptions: [],
      wordBankOptions: [],
    });
  });

  test("allows sanitation underflow without fallback top-up", () => {
    const sentence = makeLessonSentence({
      distractors: ["Hola", "Buenos dias"],
      sentence: makeSentenceRecord({ id: 20n, sentence: "Hola mundo" }),
      translation: "Hello world",
    });

    const result = prepare({
      activity: makeActivity([
        makeStep({
          id: 12n,
          kind: "reading",
          sentence: makeStepSentence({ id: 20n, sentence: "Hola mundo" }),
        }),
      ]),
      lessonSentences: [sentence],
    });

    expect(result.steps[0]?.wordBankOptions).toEqual([
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "Hola",
      },
      {
        audioUrl: null,
        romanization: null,
        translation: null,
        word: "mundo",
      },
    ]);
  });

  test("uses the provided steps override instead of the activity steps", () => {
    const result = prepare({
      activity: makeActivity(
        [
          makeStep({
            content: { text: "from activity", title: "Ignored", variant: "text" },
            id: 10n,
            kind: "static",
          }),
        ],
        { id: 99n },
      ),
      steps: [
        makeStep({
          content: { text: "from override", title: "Used", variant: "text" },
          id: 11n,
          kind: "static",
        }),
      ],
    });

    expect(result.steps).toEqual([
      expect.objectContaining({
        content: { text: "from override", title: "Used", variant: "text" },
        id: "11",
      }),
    ]);
  });
});
