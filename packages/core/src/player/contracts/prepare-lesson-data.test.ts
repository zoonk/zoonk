import { shuffle } from "@zoonk/utils/shuffle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseStepContent } from "../../steps/contract/content";
import { preparePlayerLessonData } from "./prepare-lesson-data";

vi.mock("@zoonk/utils/shuffle", () => ({ shuffle: vi.fn(<T>(items: T[]) => items) }));

const LANGUAGE_SENTENCE_STEP_LIMIT = 6;

type PreparePlayerLessonInput = Parameters<typeof preparePlayerLessonData>[0];
type LessonInput = PreparePlayerLessonInput["lesson"];
type RawStep = LessonInput["steps"][number];
type RawStepWord = NonNullable<RawStep["word"]>;
type RawStepSentence = NonNullable<RawStep["sentence"]>;
type ChapterWord = PreparePlayerLessonInput["chapterWords"][number];
type ChapterSentence = PreparePlayerLessonInput["chapterSentences"][number];
type SentenceWord = NonNullable<PreparePlayerLessonInput["sentenceWords"]>[number];
type DistractorWord = NonNullable<PreparePlayerLessonInput["distractorWords"]>[number];
const shuffleMock = vi.mocked(shuffle);

function makeWordRecord(overrides: Partial<ChapterWord["word"]> = {}): ChapterWord["word"] {
  return {
    audioUrl: null,
    id: "1",
    pronunciations: [],
    romanization: null,
    word: "word",
    ...overrides,
  };
}

function makeSentenceRecord(
  overrides: Partial<ChapterSentence["sentence"]> = {},
): ChapterSentence["sentence"] {
  return { audioUrl: null, id: "1", romanization: null, sentence: "sentence", ...overrides };
}

function makeStepWord(overrides: Partial<RawStepWord> = {}): RawStepWord {
  return { audioUrl: null, id: "1", romanization: null, word: "word", ...overrides };
}

function makeStepSentence(overrides: Partial<RawStepSentence> = {}): RawStepSentence {
  return { audioUrl: null, id: "1", romanization: null, sentence: "sentence", ...overrides };
}

function makeLessonWord(overrides: Partial<ChapterWord> = {}): ChapterWord {
  const word = overrides.word ?? makeWordRecord();

  return { distractors: [], id: word.id, translation: "translation", word, ...overrides };
}

function makeLessonSentence(overrides: Partial<ChapterSentence> = {}): ChapterSentence {
  const sentence = overrides.sentence ?? makeSentenceRecord();

  return {
    distractors: [],
    explanation: null,
    id: sentence.id,
    sentence,
    translation: "translation",
    translationDistractors: [],
    ...overrides,
  };
}

function makeSentenceWord(overrides: Partial<SentenceWord> = {}): SentenceWord {
  const word = overrides.word ?? makeWordRecord();

  return { distractors: [], id: word.id, translation: "translation", word, ...overrides };
}

function makeDistractorWord(overrides: Partial<DistractorWord> = {}): DistractorWord {
  return {
    audioUrl: null,
    id: "1",
    pronunciations: [],
    romanization: null,
    word: "word",
    ...overrides,
  };
}

function makeStep(overrides: Partial<RawStep> = {}): RawStep {
  const word = overrides.word ?? null;
  const sentence = overrides.sentence ?? null;

  return {
    chapterSentenceId: overrides.chapterSentenceId ?? sentence?.id ?? null,
    chapterWordId: overrides.chapterWordId ?? word?.id ?? null,
    content: {},
    id: "1",
    kind: "static",
    position: 0,
    sentence,
    word,
    ...overrides,
  };
}

function makeLesson(steps: RawStep[], overrides: Partial<LessonInput> = {}): LessonInput {
  return {
    description: null,
    id: "1",
    kind: "quiz",
    language: "en",
    organizationId: "org-1",
    steps,
    title: "Lesson",
    ...overrides,
  };
}

function prepare(params: Partial<PreparePlayerLessonInput> = {}) {
  return preparePlayerLessonData({
    chapterSentences: params.chapterSentences ?? [],
    chapterWords: params.chapterWords ?? [],
    distractorWords: params.distractorWords,
    lesson: params.lesson ?? makeLesson([]),
    sentenceWords: params.sentenceWords,
    steps: params.steps,
  });
}

describe(preparePlayerLessonData, () => {
  beforeEach(() => {
    shuffleMock.mockReset();
    shuffleMock.mockImplementation(<T>(items: readonly T[]) => [...items]);
  });

  it("serializes lesson and step ids to strings", () => {
    const result = prepare({
      lesson: makeLesson(
        [makeStep({ content: { text: "Hello world", title: "Intro", variant: "text" }, id: "42" })],
        { id: "99" },
      ),
    });

    expect(result.id).toBe("99");
    expect(result.steps[0]?.id).toBe("42");
  });

  it("keeps lesson metadata plus serialized lesson pools", () => {
    const word = makeLessonWord({
      distractors: ["boa tarde"],
      translation: "good evening",
      word: makeWordRecord({
        audioUrl: "/audio/boa-noite.mp3",
        id: "10",
        pronunciations: [{ pronunciation: "boa noite" }],
        word: "boa noite",
      }),
    });

    const sentence = makeLessonSentence({
      distractors: ["Abend"],
      explanation: "Greeting",
      sentence: makeSentenceRecord({
        audioUrl: "/audio/guten-morgen.mp3",
        id: "20",
        romanization: "guten morgen",
        sentence: "Guten Morgen",
      }),
      translation: "Good morning",
      translationDistractors: ["Hello"],
    });

    const result = prepare({
      chapterSentences: [sentence],
      chapterWords: [word],
      lesson: makeLesson(
        [makeStep({ content: { text: "Hello world", title: "Intro", variant: "text" } })],
        { description: "Description", id: "99", kind: "review", organizationId: "org-42" },
      ),
    });

    expect(result).toMatchObject({
      description: "Description",
      kind: "review",
      language: "en",
      organizationId: "org-42",
      title: "Lesson",
    });

    expect(result.lessonWords).toStrictEqual([
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

    expect(result.lessonSentences).toStrictEqual([
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

  it("parses supported step content and filters unsupported steps", () => {
    const result = prepare({
      lesson: makeLesson([
        makeStep({
          content: { text: "Hello world", title: "Intro", variant: "text" },
          kind: "static",
        }),
        makeStep({ id: "2", kind: "not-supported" }),
      ]),
    });

    expect(result.steps).toHaveLength(1);

    expect(result.steps[0]?.content).toStrictEqual({
      text: "Hello world",
      title: "Intro",
      variant: "text",
    });
  });

  it("populates sortOrderItems, fillBlankOptions, and matchColumnsRightItems", () => {
    const result = prepare({
      lesson: makeLesson([
        makeStep({
          content: {
            feedback: "Correct order",
            items: ["first", "second", "third"],
            question: "Sort these",
          },
          id: "1",
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
      ]),
    });

    expect(result.steps[0]?.sortOrderItems).toStrictEqual(["first", "second", "third"]);

    expect(result.steps[1]?.fillBlankOptions).toStrictEqual([
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "sky" },
      {
        audioUrl: null,
        pronunciation: null,
        romanization: "ground-rom",
        translation: null,
        word: "ground",
      },
    ]);

    expect(result.steps[2]?.matchColumnsRightItems).toStrictEqual(["1", "2"]);
  });

  it("serializes chapter-scoped distractor arrays for words and sentences", () => {
    const word = makeLessonWord({
      distractors: ["boa tarde", "bom dia"],
      translation: "good evening",
      word: makeWordRecord({ id: "10", word: "boa noite" }),
    });

    const sentence = makeLessonSentence({
      distractors: ["Abend", "Fenster"],
      sentence: makeSentenceRecord({ id: "20", sentence: "Guten Morgen, Lara." }),
      translation: "Bom dia, Lara.",
      translationDistractors: ["tchau", "logo"],
    });

    const result = prepare({
      chapterSentences: [sentence],
      chapterWords: [word],
      lesson: makeLesson([
        makeStep({
          id: "11",
          kind: "translation",
          word: makeStepWord({ id: "10", word: "boa noite" }),
        }),
        makeStep({
          id: "12",
          kind: "reading",
          sentence: makeStepSentence({ id: "20", sentence: "Guten Morgen, Lara." }),
        }),
      ]),
    });

    expect(result.lessonWords[0]?.distractors).toStrictEqual(["boa tarde", "bom dia"]);
    expect(result.lessonSentences[0]?.distractors).toStrictEqual(["Abend", "Fenster"]);
    expect(result.lessonSentences[0]?.translationDistractors).toStrictEqual(["tchau", "logo"]);
    expect(result.steps[0]?.word?.distractors).toStrictEqual(["boa tarde", "bom dia"]);
    expect(result.steps[1]?.sentence?.distractors).toStrictEqual(["Abend", "Fenster"]);
  });

  it("builds translation options from stored distractors and hydrated metadata", () => {
    const word = makeLessonWord({
      distractors: ["boa tarde", "bom dia", "até logo"],
      translation: "good evening",
      word: makeWordRecord({
        id: "10",
        pronunciations: [{ pronunciation: "boa noite" }],
        word: "boa noite",
      }),
    });

    const result = prepare({
      chapterWords: [word],
      distractorWords: [
        makeDistractorWord({
          audioUrl: "/audio/boa-tarde.mp3",
          id: "101",
          pronunciations: [{ pronunciation: "boa tarde" }],
          word: "boa tarde",
        }),
        makeDistractorWord({
          audioUrl: "/audio/bom-dia.mp3",
          id: "102",
          pronunciations: [{ pronunciation: "bom dia" }],
          word: "bom dia",
        }),
      ],
      lesson: makeLesson([
        makeStep({
          id: "11",
          kind: "translation",
          word: makeStepWord({ id: "10", word: "boa noite" }),
        }),
      ]),
    });

    expect(result.steps[0]?.translationOptions).toStrictEqual([
      {
        audioUrl: null,
        id: "10",
        pronunciation: "boa noite",
        romanization: null,
        word: "Boa noite",
      },
      {
        audioUrl: "/audio/boa-tarde.mp3",
        id: "101",
        pronunciation: "boa tarde",
        romanization: null,
        word: "Boa tarde",
      },
      {
        audioUrl: "/audio/bom-dia.mp3",
        id: "102",
        pronunciation: "bom dia",
        romanization: null,
        word: "Bom dia",
      },
      {
        audioUrl: null,
        id: "distractor:ate logo",
        pronunciation: null,
        romanization: null,
        word: "Até logo",
      },
    ]);
  });

  it("capitalizes every translation option", () => {
    const word = makeLessonWord({
      distractors: ["boa tarde", "boa noite"],
      translation: "Good morning",
      word: makeWordRecord({ id: "10", word: "Bom dia" }),
    });

    const result = prepare({
      chapterWords: [word],
      lesson: makeLesson([
        makeStep({
          id: "11",
          kind: "translation",
          word: makeStepWord({ id: "10", word: "Bom dia" }),
        }),
      ]),
    });

    expect(result.steps[0]?.translationOptions.map((option) => option.word)).toStrictEqual([
      "Bom dia",
      "Boa tarde",
      "Boa noite",
    ]);
  });

  it("capitalizes under-cased generated translation answers", () => {
    const word = makeLessonWord({
      distractors: ["i'm busy", "i'm tired"],
      translation: "Estoy bien",
      word: makeWordRecord({ id: "10", word: "i'm fine" }),
    });

    const result = prepare({
      chapterWords: [word],
      lesson: makeLesson([
        makeStep({
          id: "11",
          kind: "translation",
          word: makeStepWord({ id: "10", word: "i'm fine" }),
        }),
      ]),
    });

    expect(result.steps[0]?.translationOptions.map((option) => option.word)).toStrictEqual([
      "I'm fine",
      "I'm busy",
      "I'm tired",
    ]);
  });

  it("adds the visible translation prompt punctuation to every translation option", () => {
    const word = makeLessonWord({
      distractors: ["Boa tarde", "Boa noite."],
      translation: "Good morning!",
      word: makeWordRecord({ id: "10", word: "Bom dia" }),
    });

    const result = prepare({
      chapterWords: [word],
      lesson: makeLesson([
        makeStep({
          id: "11",
          kind: "translation",
          word: makeStepWord({ id: "10", word: "Bom dia" }),
        }),
      ]),
    });

    expect(result.steps[0]?.translationOptions.map((option) => option.word)).toStrictEqual([
      "Bom dia!",
      "Boa tarde!",
      "Boa noite!",
    ]);
  });

  it("strips terminal punctuation from translation options when the prompt has none", () => {
    const word = makeLessonWord({
      distractors: ["Boa tarde.", "Boa noite!"],
      translation: "Good morning",
      word: makeWordRecord({ id: "10", word: "Bom dia" }),
    });

    const result = prepare({
      chapterWords: [word],
      distractorWords: [
        makeDistractorWord({ audioUrl: "/audio/boa-tarde.mp3", id: "101", word: "Boa tarde." }),
      ],
      lesson: makeLesson([
        makeStep({
          id: "11",
          kind: "translation",
          word: makeStepWord({ id: "10", word: "Bom dia" }),
        }),
      ]),
    });

    expect(result.steps[0]?.translationOptions).toMatchObject([
      { id: "10", word: "Bom dia" },
      { audioUrl: "/audio/boa-tarde.mp3", id: "101", word: "Boa tarde" },
      { id: "distractor:boa noite", word: "Boa noite" },
    ]);
  });

  it("uses the exact chapter word referenced by the step when resources share a word", () => {
    const vocabularyWord = makeLessonWord({
      distractors: ["Danke"],
      id: "chapter-word-vocabulary",
      translation: "Tchau",
      word: makeWordRecord({ id: "10", word: "Tschüss" }),
    });

    const readingWord = makeLessonWord({
      distractors: [],
      id: "chapter-word-reading",
      translation: "tchau",
      word: makeWordRecord({ id: "10", word: "Tschüss" }),
    });

    const result = prepare({
      chapterWords: [vocabularyWord, readingWord],
      lesson: makeLesson([
        makeStep({
          chapterWordId: "chapter-word-vocabulary",
          id: "11",
          kind: "translation",
          word: makeStepWord({ id: "10", word: "Tschüss" }),
        }),
      ]),
    });

    expect(result.steps[0]?.word?.translation).toBe("Tchau");

    expect(result.steps[0]?.translationOptions).toStrictEqual([
      { audioUrl: null, id: "10", pronunciation: null, romanization: null, word: "Tschüss" },
      {
        audioUrl: null,
        id: "distractor:danke",
        pronunciation: null,
        romanization: null,
        word: "Danke",
      },
    ]);
  });

  it("drops supported steps whose content does not match the content contract", () => {
    const result = prepare({
      lesson: makeLesson([
        makeStep({ content: {}, id: "1", kind: "static" }),
        makeStep({
          content: { text: "Hello world", title: "Intro", variant: "text" },
          id: "2",
          kind: "static",
        }),
      ]),
    });

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.id).toBe("2");
  });

  it("serializes multiple choice content", () => {
    const result = prepare({
      lesson: makeLesson([
        makeStep({
          content: {
            options: [
              { feedback: "Yes", id: "alpha", isCorrect: true, text: "Alpha" },
              { feedback: "No", id: "beta", isCorrect: false, text: "Beta" },
            ],
            question: "Pick one",
          },
          id: "30",
          kind: "multipleChoice",
        }),
      ]),
    });

    expect(result.steps[0]?.content).toStrictEqual({
      options: [
        { feedback: "Yes", id: "alpha", isCorrect: true, text: "Alpha" },
        { feedback: "No", id: "beta", isCorrect: false, text: "Beta" },
      ],
      question: "Pick one",
    });
  });

  it("shuffles select image options during serialization", () => {
    shuffleMock.mockImplementationOnce((items) => items.toReversed());

    const result = prepare({
      lesson: makeLesson([
        makeStep({
          content: {
            options: [
              {
                feedback: "Correct",
                id: "image-1",
                isCorrect: true,
                prompt: "Alpha",
                url: "/alpha.png",
              },
              {
                feedback: "Wrong",
                id: "image-2",
                isCorrect: false,
                prompt: "Beta",
                url: "/beta.png",
              },
            ],
            question: "Pick the matching image",
          },
          id: "32",
          kind: "selectImage",
        }),
      ]),
    });

    const selectImageStep = result.steps[0];

    expect(selectImageStep?.kind).toBe("selectImage");

    if (selectImageStep?.kind !== "selectImage") {
      return;
    }

    const selectImageContent = parseStepContent("selectImage", selectImageStep.content);

    expect(selectImageContent.options.map(({ id }) => id)).toStrictEqual(["image-2", "image-1"]);
  });

  it("shuffles and caps reading lesson steps during serialization", () => {
    shuffleMock.mockImplementationOnce((items) => items.toReversed());

    const steps = Array.from({ length: LANGUAGE_SENTENCE_STEP_LIMIT + 2 }, (_, index) =>
      makeStep({ id: String(index + 1), kind: "reading", position: index }),
    );

    const result = prepare({ lesson: makeLesson(steps, { kind: "reading" }) });

    expect(result.steps.map((step) => step.id)).toStrictEqual(
      steps
        .toReversed()
        .slice(0, LANGUAGE_SENTENCE_STEP_LIMIT)
        .map((step) => step.id),
    );
  });

  it("shuffles and caps listening lesson steps during serialization", () => {
    shuffleMock.mockImplementationOnce((items) => items.toReversed());

    const steps = Array.from({ length: LANGUAGE_SENTENCE_STEP_LIMIT + 2 }, (_, index) =>
      makeStep({ id: String(index + 1), kind: "listening", position: index }),
    );

    const result = prepare({ lesson: makeLesson(steps, { kind: "listening" }) });

    expect(result.steps.map((step) => step.id)).toStrictEqual(
      steps
        .toReversed()
        .slice(0, LANGUAGE_SENTENCE_STEP_LIMIT)
        .map((step) => step.id),
    );
  });

  it("shuffles every translation lesson step during serialization", () => {
    shuffleMock.mockImplementationOnce((items) => items.toReversed());

    const steps = Array.from({ length: LANGUAGE_SENTENCE_STEP_LIMIT + 2 }, (_, index) =>
      makeStep({ id: String(index + 1), kind: "translation", position: index }),
    );

    const result = prepare({ lesson: makeLesson(steps, { kind: "translation" }) });

    expect(result.steps.map((step) => step.id)).toStrictEqual(
      steps.toReversed().map((step) => step.id),
    );
  });

  it("keeps every step for non-sentence lesson kinds", () => {
    const steps = Array.from({ length: 8 }, (_, index) =>
      makeStep({
        content: { text: `Step ${index + 1}`, title: `Step ${index + 1}`, variant: "text" },
        id: String(index + 1),
        position: index,
      }),
    );

    const result = prepare({ lesson: makeLesson(steps, { kind: "explanation" }) });

    expect(result.steps.map((step) => step.id)).toStrictEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
  });

  it("builds reading and listening word banks from stored distractors only", () => {
    const sentence = makeLessonSentence({
      distractors: ["Abend", "Fenster", "Guten Tag"],
      sentence: makeSentenceRecord({ id: "20", sentence: "Guten Morgen, Lara." }),
      translation: "Bom dia, Lara.",
      translationDistractors: ["tchau", "boa noite"],
    });

    const result = prepare({
      chapterSentences: [sentence],
      distractorWords: [
        makeDistractorWord({
          audioUrl: "/audio/abend.mp3",
          id: "201",
          pronunciations: [{ pronunciation: "abend" }],
          romanization: "abend",
          word: "Abend",
        }),
      ],
      lesson: makeLesson([
        makeStep({
          id: "12",
          kind: "reading",
          sentence: makeStepSentence({ id: "20", sentence: "Guten Morgen, Lara." }),
        }),
        makeStep({
          id: "13",
          kind: "listening",
          sentence: makeStepSentence({ id: "20", sentence: "Guten Morgen, Lara." }),
        }),
      ]),
    });

    expect(result.steps[0]?.wordBankOptions).toStrictEqual([
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "Guten" },
      {
        audioUrl: null,
        pronunciation: null,
        romanization: null,
        translation: null,
        word: "Morgen,",
      },
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "Lara." },
      {
        audioUrl: "/audio/abend.mp3",
        pronunciation: "abend",
        romanization: "abend",
        translation: null,
        word: "abend",
      },
      {
        audioUrl: null,
        pronunciation: null,
        romanization: null,
        translation: null,
        word: "fenster",
      },
    ]);

    expect(result.steps[1]?.wordBankOptions).toStrictEqual([
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "Bom" },
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "dia," },
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "Lara." },
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "tchau" },
    ]);
  });

  it("populates sentenceWordOptions from canonical sentence tokens", () => {
    const sentence = makeLessonSentence({
      sentence: makeSentenceRecord({ id: "20", sentence: "Guten Morgen" }),
      translation: "Good morning",
    });

    const result = prepare({
      chapterSentences: [sentence],
      chapterWords: [
        makeLessonWord({
          translation: "good morning",
          word: makeWordRecord({ id: "10", romanization: "guten morgen", word: "Guten Morgen" }),
        }),
      ],
      lesson: makeLesson([
        makeStep({
          id: "12",
          kind: "reading",
          sentence: makeStepSentence({ id: "20", sentence: "Guten Morgen" }),
        }),
      ]),
    });

    expect(result.steps[0]?.sentenceWordOptions).toStrictEqual([
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

  it("keeps sentence word metadata from sentence words when available", () => {
    const sentence = makeLessonSentence({
      sentence: makeSentenceRecord({ id: "20", sentence: "gato bonito" }),
      translation: "pretty cat",
    });

    const result = prepare({
      chapterSentences: [sentence],
      chapterWords: [
        makeLessonWord({
          translation: "cat (lesson)",
          word: makeWordRecord({ audioUrl: "/audio/lesson-gato.mp3", id: "10", word: "gato" }),
        }),
      ],
      lesson: makeLesson([
        makeStep({
          id: "40",
          kind: "reading",
          sentence: makeStepSentence({ id: "20", sentence: "gato bonito" }),
        }),
      ]),
      sentenceWords: [
        makeSentenceWord({
          translation: "cat (sentence)",
          word: makeWordRecord({
            audioUrl: "/audio/sentence-gato.mp3",
            id: "11",
            romanization: "ga-to",
            word: "gato",
          }),
        }),
      ],
    });

    expect(result.steps[0]?.sentenceWordOptions).toStrictEqual([
      {
        audioUrl: "/audio/sentence-gato.mp3",
        pronunciation: null,
        romanization: "ga-to",
        translation: "cat (lesson)",
        word: "gato",
      },
      {
        audioUrl: null,
        pronunciation: null,
        romanization: null,
        translation: null,
        word: "bonito",
      },
    ]);
  });

  it("keeps sentenceWordOptions empty for steps without a sentence", () => {
    const result = prepare({
      lesson: makeLesson([
        makeStep({
          content: { text: "Hello world", title: "Intro", variant: "text" },
          kind: "static",
        }),
      ]),
    });

    expect(result.steps[0]?.sentenceWordOptions).toStrictEqual([]);
  });

  it("keeps option helper arrays empty for unrelated step kinds", () => {
    const result = prepare({
      lesson: makeLesson([
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

  it("allows sanitation underflow without fallback top-up", () => {
    const sentence = makeLessonSentence({
      distractors: ["Hola", "Buenos dias"],
      sentence: makeSentenceRecord({ id: "20", sentence: "Hola mundo" }),
      translation: "Hello world",
    });

    const result = prepare({
      chapterSentences: [sentence],
      lesson: makeLesson([
        makeStep({
          id: "12",
          kind: "reading",
          sentence: makeStepSentence({ id: "20", sentence: "Hola mundo" }),
        }),
      ]),
    });

    expect(result.steps[0]?.wordBankOptions).toStrictEqual([
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "Hola" },
      { audioUrl: null, pronunciation: null, romanization: null, translation: null, word: "mundo" },
    ]);
  });

  it("uses the provided steps override instead of the lesson steps", () => {
    const result = prepare({
      lesson: makeLesson(
        [
          makeStep({
            content: { text: "from lesson", title: "Ignored", variant: "text" },
            id: "10",
            kind: "static",
          }),
        ],
        { id: "99" },
      ),
      steps: [
        makeStep({
          content: { text: "from override", title: "Used", variant: "text" },
          id: "11",
          kind: "static",
        }),
      ],
    });

    expect(result.steps).toStrictEqual([
      expect.objectContaining({
        content: { text: "from override", title: "Used", variant: "text" },
        id: "11",
      }),
    ]);
  });
});
