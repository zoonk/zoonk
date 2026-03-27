import {
  attachTranslationsToSteps,
  toLessonSentenceInputs,
  toLessonWordInputs,
} from "@/app/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]/a/[position]/activity-data-mappers";
import { prepareActivityData } from "@zoonk/player/prepare-activity-data";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { lessonWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, expectTypeOf, test } from "vitest";
import { getActivity } from "./get-activity";
import { getLessonSentences } from "./get-lesson-sentences";
import { getLessonWords } from "./get-lesson-words";

describe(prepareActivityData, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });
  });

  test("serializes BigInt ids to strings", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 100,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "test", title: "Test", variant: "text" },
      isPublished: true,
      position: 0,
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 100 });
    const stepsWithTranslations = attachTranslationsToSteps(raw!.steps, [], []);
    const result = prepareActivityData({ ...raw!, steps: stepsWithTranslations }, [], []);

    expectTypeOf(result.id).toBeString();
    expect(result.id).toBe(String(activity.id));
    const firstStep = result.steps[0];
    expect(firstStep).toBeDefined();
    if (firstStep) {
      expectTypeOf(firstStep.id).toBeString();
    }
  });

  test("parses step content for supported kinds", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 101,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "Hello world", title: "Intro", variant: "text" },
      isPublished: true,
      kind: "static",
      position: 0,
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 101 });
    const stepsWithTranslations = attachTranslationsToSteps(raw!.steps, [], []);
    const result = prepareActivityData({ ...raw!, steps: stepsWithTranslations }, [], []);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.kind).toBe("static");
    expect(result.steps[0]?.content).toEqual({
      text: "Hello world",
      title: "Intro",
      variant: "text",
    });
  });

  test("serializes word data on steps with word relations", async () => {
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const [word, activity] = await Promise.all([
      wordFixture({
        audioUrl: "https://example.com/word.mp3",
        organizationId: org.id,
        romanization: null,
        word: `hola-${crypto.randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        language: "en",
        lessonId: newLesson.id,
        organizationId: org.id,
        position: 0,
      }),
    ]);

    await lessonWordFixture({
      distractorUnsafeTranslations: [],
      lessonId: newLesson.id,
      translation: "hello",
      userLanguage: "en",
      wordId: word.id,
    });

    await stepFixture({
      activityId: activity.id,
      content: {},
      isPublished: true,
      kind: "vocabulary",
      position: 0,
      wordId: word.id,
    });

    const [raw, lessonWords] = await Promise.all([
      getActivity({ lessonId: newLesson.id, position: 0 }),
      getLessonWords({ lessonId: newLesson.id }),
    ]);

    const stepsWithTranslations = attachTranslationsToSteps(raw!.steps, lessonWords, []);
    const result = prepareActivityData({ ...raw!, steps: stepsWithTranslations }, [], []);

    expect(result.steps[0]?.word).toEqual({
      audioUrl: "https://example.com/word.mp3",
      distractorUnsafeTranslations: [],
      id: String(word.id),
      pronunciation: null,
      romanization: null,
      translation: "hello",
      word: word.word,
    });
  });

  test("serializes sentence data on steps with sentence relations", async () => {
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const [sentence, activity] = await Promise.all([
      sentenceFixture({
        audioUrl: "https://example.com/sent.mp3",
        distractorUnsafeSentences: ["ohayo"],
        organizationId: org.id,
        romanization: "konnichiwa",
        sentence: `konnichiwa-${crypto.randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "reading",
        language: "en",
        lessonId: newLesson.id,
        organizationId: org.id,
        position: 0,
      }),
    ]);

    await lessonSentenceFixture({
      distractorUnsafeTranslations: ["hi"],
      explanation: null,
      lessonId: newLesson.id,
      sentenceId: sentence.id,
      translation: "hello",
      userLanguage: "en",
    });

    await stepFixture({
      activityId: activity.id,
      content: {},
      isPublished: true,
      kind: "reading",
      position: 0,
      sentenceId: sentence.id,
    });

    const [raw, lessonSentences] = await Promise.all([
      getActivity({ lessonId: newLesson.id, position: 0 }),
      getLessonSentences({ lessonId: newLesson.id }),
    ]);

    const stepsWithTranslations = attachTranslationsToSteps(raw!.steps, [], lessonSentences);
    const result = prepareActivityData({ ...raw!, steps: stepsWithTranslations }, [], []);

    expect(result.steps[0]?.sentence).toEqual({
      audioUrl: "https://example.com/sent.mp3",
      distractorUnsafeSentences: ["ohayo"],
      distractorUnsafeTranslations: ["hi"],
      explanation: null,
      id: String(sentence.id),
      romanization: "konnichiwa",
      sentence: sentence.sentence,
      translation: "hello",
    });
  });

  test("filters out steps with unsupported kinds", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 106,
    });

    await Promise.all([
      stepFixture({
        activityId: activity.id,
        content: { text: "Valid step", title: "Valid", variant: "text" },
        isPublished: true,
        kind: "static",
        position: 0,
      }),
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "arrangeWords",
        position: 1,
      }),
    ]);

    const raw = await getActivity({ lessonId: lesson.id, position: 106 });
    const stepsWithTranslations = attachTranslationsToSteps(raw!.steps, [], []);
    const result = prepareActivityData({ ...raw!, steps: stepsWithTranslations }, [], []);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.kind).toBe("static");
  });

  test("includes lesson word and sentence pools", async () => {
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const [word1, word2, sentence1] = await Promise.all([
      wordFixture({ organizationId: org.id }),
      wordFixture({ organizationId: org.id }),
      sentenceFixture({ organizationId: org.id }),
    ]);

    await Promise.all([
      lessonWordFixture({ lessonId: newLesson.id, wordId: word1.id }),
      lessonWordFixture({ lessonId: newLesson.id, wordId: word2.id }),
      lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence1.id }),
    ]);

    const [lessonWords, lessonSentences] = await Promise.all([
      getLessonWords({ lessonId: newLesson.id }),
      getLessonSentences({ lessonId: newLesson.id }),
    ]);

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "vocabulary",
      language: "en",
      lessonId: newLesson.id,
      organizationId: org.id,
      position: 0,
    });

    await stepFixture({
      activityId: activity.id,
      content: {},
      isPublished: true,
      kind: "vocabulary",
      position: 0,
    });

    const raw = await getActivity({ lessonId: newLesson.id, position: 0 });
    const stepsWithTranslations = attachTranslationsToSteps(
      raw!.steps,
      lessonWords,
      lessonSentences,
    );
    const result = prepareActivityData(
      { ...raw!, steps: stepsWithTranslations },
      toLessonWordInputs(lessonWords),
      toLessonSentenceInputs(lessonSentences),
    );

    expect(result.lessonWords).toHaveLength(2);
    expect(result.lessonSentences).toHaveLength(1);

    const wordIds = result.lessonWords.map((word) => word.id);
    expect(wordIds).toContain(String(word1.id));
    expect(wordIds).toContain(String(word2.id));
    expect(result.lessonSentences[0]?.id).toBe(String(sentence1.id));
  });

  test("shuffles multiple choice options without losing or duplicating elements", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 109,
    });

    await stepFixture({
      activityId: activity.id,
      content: {
        kind: "core",
        options: [
          { feedback: "Yes", isCorrect: true, text: "Alpha" },
          { feedback: "No", isCorrect: false, text: "Beta" },
          { feedback: "No", isCorrect: false, text: "Gamma" },
          { feedback: "No", isCorrect: false, text: "Delta" },
        ],
        question: "Pick the correct one",
      },
      isPublished: true,
      kind: "multipleChoice",
      position: 0,
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 109 });
    const stepsWithTranslations = attachTranslationsToSteps(raw!.steps, [], []);
    const result = prepareActivityData({ ...raw!, steps: stepsWithTranslations }, [], []);

    expect(result.steps).toHaveLength(1);

    const step = result.steps[0]!;
    expect(step.kind).toBe("multipleChoice");

    const content = step.content as {
      kind: string;
      options: { text: string }[];
      question: string;
    };

    const optionTexts = content.options.map((opt) => opt.text).toSorted();
    expect(optionTexts).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);
  });

  test("copies distractorUnsafeTranslations arrays for translation options", () => {
    const stepWord = {
      audioUrl: null,
      distractorUnsafeTranslations: ["hello"],
      id: BigInt(1),
      pronunciation: null,
      romanization: null,
      translation: "hello",
      word: "hola",
    };

    const lessonWord = {
      audioUrl: null,
      distractorUnsafeTranslations: ["cat"],
      id: BigInt(2),
      pronunciation: null,
      romanization: null,
      translation: "cat",
      word: "gato",
    };

    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(9),
      kind: "translation",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(10),
          kind: "translation",
          position: 0,
          sentence: null,
          word: stepWord,
        },
      ],
      title: "Translation",
    };

    const lessonWords = [stepWord, lessonWord];
    const result = prepareActivityData(activity, lessonWords, []);
    const translationStep = result.steps[0];
    const translationOptions = translationStep?.translationOptions ?? [];
    const serializedStepWord = translationOptions.find((word) => word.id === String(stepWord.id));

    const inputAlternatives = stepWord.distractorUnsafeTranslations;
    expect(serializedStepWord).toBeDefined();
    expect(serializedStepWord?.distractorUnsafeTranslations).toEqual(inputAlternatives);
    expect(serializedStepWord?.distractorUnsafeTranslations).not.toBe(inputAlternatives);
    expect(result.lessonWords[0]?.distractorUnsafeTranslations).not.toBe(inputAlternatives);
  });

  test("translation options use fallback words without leaking them into lessonWords", () => {
    const stepWord = {
      audioUrl: null,
      distractorUnsafeTranslations: ["hi"],
      id: BigInt(11),
      pronunciation: null,
      romanization: null,
      translation: "hello",
      word: "hola",
    };

    const lessonWords = [
      stepWord,
      {
        audioUrl: null,
        distractorUnsafeTranslations: ["hello"],
        id: BigInt(12),
        pronunciation: null,
        romanization: null,
        translation: "hi",
        word: "oi",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(13),
        pronunciation: null,
        romanization: null,
        translation: "cat",
        word: "gato",
      },
    ];

    const fallbackWords = [
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(14),
        pronunciation: null,
        romanization: null,
        translation: "dog",
        word: "perro",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(15),
        pronunciation: null,
        romanization: null,
        translation: "bird",
        word: "pajaro",
      },
    ];

    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(16),
      kind: "translation",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(17),
          kind: "translation",
          position: 0,
          sentence: null,
          word: stepWord,
        },
      ],
      title: "Translation Fallback",
    };

    const result = prepareActivityData(activity, lessonWords, [], [], fallbackWords);
    const translationOptions = result.steps[0]?.translationOptions ?? [];

    expect(translationOptions.map((word) => word.word).toSorted()).toEqual([
      "gato",
      "hola",
      "pajaro",
      "perro",
    ]);
    expect(result.lessonWords.map((word) => word.word).toSorted()).toEqual(["gato", "hola", "oi"]);
  });

  test("reading word bank uses fallback words to reach four visible distractors without leaking them into lessonWords", () => {
    const lessonWords = [
      {
        audioUrl: null,
        distractorUnsafeTranslations: ["hi"],
        id: BigInt(18),
        pronunciation: null,
        romanization: null,
        translation: "hello",
        word: "Hola",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: ["hello"],
        id: BigInt(19),
        pronunciation: null,
        romanization: null,
        translation: "hi",
        word: "Salut",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(20),
        pronunciation: null,
        romanization: null,
        translation: "cat",
        word: "gato",
      },
    ];

    const fallbackWords = [
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(21),
        pronunciation: null,
        romanization: null,
        translation: "dog",
        word: "perro",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(22),
        pronunciation: null,
        romanization: null,
        translation: "bird",
        word: "pajaro",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(23),
        pronunciation: null,
        romanization: null,
        translation: "fish",
        word: "pez",
      },
    ];

    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(24),
      kind: "reading",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(25),
          kind: "reading",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(26),
            romanization: null,
            sentence: "Hola mundo",
            translation: "Hello world",
          },
          word: null,
        },
      ],
      title: "Reading Fallback",
    };

    const result = prepareActivityData(activity, lessonWords, [], [], fallbackWords);
    const wordBankWords = (result.steps[0]?.wordBankOptions ?? []).map((option) => option.word);

    expect(wordBankWords).toHaveLength(6);
    expect(wordBankWords.toSorted()).toEqual(["Hola", "gato", "mundo", "pajaro", "perro", "pez"]);
    expect(result.lessonWords.map((word) => word.word).toSorted()).toEqual([
      "Hola",
      "Salut",
      "gato",
    ]);
  });

  test("reading step gets word bank with sentence words and distractors from lesson word fields", async () => {
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const uniqueId = crypto.randomUUID().slice(0, 8);
    const sentenceText = `Hola mundo ${uniqueId}`;
    const [sentence, word1, word2, activity] = await Promise.all([
      sentenceFixture({
        organizationId: org.id,
        sentence: sentenceText,
      }),
      wordFixture({
        organizationId: org.id,
        word: `gato-${uniqueId}`,
      }),
      wordFixture({
        organizationId: org.id,
        word: `perro-${uniqueId}`,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "reading",
        language: "en",
        lessonId: newLesson.id,
        organizationId: org.id,
        position: 0,
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({
        lessonId: newLesson.id,
        sentenceId: sentence.id,
        translation: `Hello world ${uniqueId}`,
        userLanguage: "en",
      }),
      lessonWordFixture({
        lessonId: newLesson.id,
        translation: `cat-${uniqueId}`,
        userLanguage: "en",
        wordId: word1.id,
      }),
      lessonWordFixture({
        lessonId: newLesson.id,
        translation: `dog-${uniqueId}`,
        userLanguage: "en",
        wordId: word2.id,
      }),
    ]);

    await stepFixture({
      activityId: activity.id,
      content: {},
      isPublished: true,
      kind: "reading",
      position: 0,
      sentenceId: sentence.id,
    });

    const [raw, lessonWords, lessonSentences] = await Promise.all([
      getActivity({ lessonId: newLesson.id, position: 0 }),
      getLessonWords({ lessonId: newLesson.id }),
      getLessonSentences({ lessonId: newLesson.id }),
    ]);

    const stepsWithTranslations = attachTranslationsToSteps(
      raw!.steps,
      lessonWords,
      lessonSentences,
    );
    const result = prepareActivityData(
      { ...raw!, steps: stepsWithTranslations },
      toLessonWordInputs(lessonWords),
      [],
    );
    const wordBankWords = (result.steps[0]?.wordBankOptions ?? []).map((option) => option.word);

    // Should contain the correct sentence words
    for (const word of sentenceText.split(" ")) {
      expect(wordBankWords).toContain(word);
    }

    // Should contain distractor words from lesson word .word field (for reading)
    expect(wordBankWords).toContain(`gato-${uniqueId}`);
    expect(wordBankWords).toContain(`perro-${uniqueId}`);
  });

  test("listening step gets word bank with translation words and distractors from lesson word translation fields", async () => {
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const uniqueId = crypto.randomUUID().slice(0, 8);
    const translationText = `Hello world ${uniqueId}`;
    const [sentence, word1, word2, activity] = await Promise.all([
      sentenceFixture({
        organizationId: org.id,
        sentence: `Hola mundo ${uniqueId}`,
      }),
      wordFixture({
        organizationId: org.id,
        word: `gato-${uniqueId}`,
      }),
      wordFixture({
        organizationId: org.id,
        word: `perro-${uniqueId}`,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "listening",
        language: "en",
        lessonId: newLesson.id,
        organizationId: org.id,
        position: 0,
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({
        lessonId: newLesson.id,
        sentenceId: sentence.id,
        translation: translationText,
        userLanguage: "en",
      }),
      lessonWordFixture({
        lessonId: newLesson.id,
        translation: `cat-${uniqueId}`,
        userLanguage: "en",
        wordId: word1.id,
      }),
      lessonWordFixture({
        lessonId: newLesson.id,
        translation: `dog-${uniqueId}`,
        userLanguage: "en",
        wordId: word2.id,
      }),
    ]);

    await stepFixture({
      activityId: activity.id,
      content: {},
      isPublished: true,
      kind: "listening",
      position: 0,
      sentenceId: sentence.id,
    });

    const [raw, lessonWords, lessonSentences] = await Promise.all([
      getActivity({ lessonId: newLesson.id, position: 0 }),
      getLessonWords({ lessonId: newLesson.id }),
      getLessonSentences({ lessonId: newLesson.id }),
    ]);

    const stepsWithTranslations = attachTranslationsToSteps(
      raw!.steps,
      lessonWords,
      lessonSentences,
    );

    const result = prepareActivityData(
      { ...raw!, steps: stepsWithTranslations },
      toLessonWordInputs(lessonWords),
      [],
    );
    const wordBankWords = (result.steps[0]?.wordBankOptions ?? []).map((option) => option.word);

    // Should contain the correct translation words
    for (const word of translationText.split(" ")) {
      expect(wordBankWords).toContain(word);
    }

    // Should contain distractor words from lesson word .translation field (for listening)
    expect(wordBankWords).toContain(`cat-${uniqueId}`);
    expect(wordBankWords).toContain(`dog-${uniqueId}`);
  });

  test("correct words get metadata from lesson words when no sentence words provided", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(70),
      kind: "reading",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(71),
          kind: "reading",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(72),
            romanization: null,
            sentence: "gato bonito",
            translation: "pretty cat",
          },
          word: null,
        },
      ],
      title: "Reading Fallback",
    };

    const lessonWords = [
      {
        audioUrl: "https://example.com/gato.mp3",
        distractorUnsafeTranslations: [],
        id: BigInt(73),
        pronunciation: null,
        romanization: "ga-to",
        translation: "cat",
        word: "gato",
      },
    ];

    // No sentenceWords passed — fallback to lesson words for metadata
    const result = prepareActivityData(activity, lessonWords, []);
    const wordBank = result.steps[0]?.wordBankOptions ?? [];

    const gatoOption = wordBank.find((option) => option.word === "gato");
    expect(gatoOption).toBeDefined();
    expect(gatoOption?.translation).toBe("cat");
    expect(gatoOption?.romanization).toBe("ga-to");
    expect(gatoOption?.audioUrl).toBe("https://example.com/gato.mp3");
  });

  test("sentence words take priority over lesson words for correct word metadata", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(74),
      kind: "reading",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(75),
          kind: "reading",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(76),
            romanization: null,
            sentence: "gato bonito",
            translation: "pretty cat",
          },
          word: null,
        },
      ],
      title: "Reading Priority",
    };

    const lessonWords = [
      {
        audioUrl: "https://example.com/lesson-gato.mp3",
        distractorUnsafeTranslations: [],
        id: BigInt(77),
        pronunciation: null,
        romanization: null,
        translation: "cat (lesson)",
        word: "gato",
      },
    ];

    const sentenceWords = [
      {
        audioUrl: "https://example.com/sentence-gato.mp3",
        distractorUnsafeTranslations: [],
        id: BigInt(78),
        pronunciation: null,
        romanization: "ga-to",
        translation: "cat (sentence)",
        word: "gato",
      },
    ];

    const result = prepareActivityData(activity, lessonWords, [], sentenceWords);
    const wordBank = result.steps[0]?.wordBankOptions ?? [];

    const gatoOption = wordBank.find((option) => option.word === "gato");
    expect(gatoOption).toBeDefined();
    // Translation comes from lessonWords (flat serialized), audioUrl/romanization from sentenceWords
    expect(gatoOption?.translation).toBe("cat (lesson)");
    expect(gatoOption?.audioUrl).toBe("https://example.com/sentence-gato.mp3");
    expect(gatoOption?.romanization).toBe("ga-to");
  });

  test("word bank removes duplicates between correct and distractor words", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(20),
      kind: "reading",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(21),
          kind: "reading",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(22),
            romanization: null,
            sentence: "Hola mundo",
            translation: "Hello world",
          },
          word: null,
        },
      ],
      title: "Reading",
    };

    // Distractor word "hola" overlaps with correct word "Hola" (case-insensitive)
    const lessonWords = [
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(23),
        pronunciation: null,
        romanization: null,
        translation: "hello",
        word: "hola",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(24),
        pronunciation: null,
        romanization: null,
        translation: "cat",
        word: "gato",
      },
    ];

    const result = prepareActivityData(activity, lessonWords, []);
    const wordBank = result.steps[0]?.wordBankOptions ?? [];

    // "hola" should be excluded because it duplicates "Hola" (case-insensitive)
    const holaCount = wordBank.filter((option) => option.word.toLowerCase() === "hola").length;
    expect(holaCount).toBe(1); // Only the correct "Hola"
  });

  test("reading word bank uses distractor-unsafe sentences only to suppress distractors", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(25),
      kind: "reading",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(26),
          kind: "reading",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: ["Guten Morgen Lara"],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(27),
            romanization: null,
            sentence: "Guten Tag Lara",
            translation: "Good day Lara",
          },
          word: null,
        },
      ],
      title: "Reading Variants",
    };

    const lessonWords = [
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(28),
        pronunciation: null,
        romanization: null,
        translation: "morning",
        word: "Morgen",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(29),
        pronunciation: null,
        romanization: null,
        translation: "evening",
        word: "Abend",
      },
    ];

    const result = prepareActivityData(activity, lessonWords, []);
    const wordBank = result.steps[0]?.wordBankOptions ?? [];
    const wordBankWords = wordBank.map((option) => option.word);

    expect(wordBankWords).toContain("Tag");
    expect(wordBankWords).toContain("Abend");
    expect(wordBankWords).not.toContain("Morgen");
  });

  test("listening word bank uses distractor-unsafe translations only to suppress distractors", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(35),
      kind: "listening",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(36),
          kind: "listening",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: ["Good morning I am Lara"],
            explanation: null,
            id: BigInt(37),
            romanization: null,
            sentence: "Bom dia eu sou Lara",
            translation: "Good day I am Lara",
          },
          word: null,
        },
      ],
      title: "Listening Variants",
    };

    const lessonWords = [
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(38),
        pronunciation: null,
        romanization: null,
        translation: "morning",
        word: "Morgen",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(39),
        pronunciation: null,
        romanization: null,
        translation: "morning",
        word: "morning",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(40),
        pronunciation: null,
        romanization: null,
        translation: "evening",
        word: "evening",
      },
    ];

    const result = prepareActivityData(activity, lessonWords, []);
    const wordBank = result.steps[0]?.wordBankOptions ?? [];
    const wordBankWords = wordBank.map((option) => option.word);

    expect(wordBankWords).toContain("day");
    expect(wordBankWords).toContain("evening");
    expect(wordBankWords).not.toContain("morning");
  });

  test("excludes distractors that match correct words when ignoring punctuation", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(30),
      kind: "reading",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(31),
          kind: "reading",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(32),
            romanization: null,
            sentence: "Sabes you?",
            translation: "Know you?",
          },
          word: null,
        },
      ],
      title: "Punctuation Reading",
    };

    // Distractor "you" (from .word) overlaps with correct word "you?" after stripping punctuation
    const lessonWords = [
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(33),
        pronunciation: null,
        romanization: null,
        translation: "you",
        word: "you",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(34),
        pronunciation: null,
        romanization: null,
        translation: "cat",
        word: "gato",
      },
    ];

    const result = prepareActivityData(activity, lessonWords, []);
    const wordBankWords = (result.steps[0]?.wordBankOptions ?? []).map((option) => option.word);

    // "you" distractor should be excluded because "you?" is already a correct word
    expect(wordBankWords).toContain("you?");
    expect(wordBankWords).not.toContain("you");
  });

  test("deduplicates distractors that differ only by punctuation", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(40),
      kind: "reading",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(41),
          kind: "reading",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(42),
            romanization: null,
            sentence: "Hola amigos",
            translation: "Hello friends",
          },
          word: null,
        },
      ],
      title: "Distractor Dedup",
    };

    // Two lesson words produce distractors "tu" and "tu?" after splitting
    const lessonWords = [
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(43),
        pronunciation: null,
        romanization: null,
        translation: "you",
        word: "tu",
      },
      {
        audioUrl: null,
        distractorUnsafeTranslations: [],
        id: BigInt(44),
        pronunciation: null,
        romanization: null,
        translation: "you?",
        word: "tu?",
      },
    ];

    const result = prepareActivityData(activity, lessonWords, []);
    const wordBank = result.steps[0]?.wordBankOptions ?? [];

    // Only one variant of "tu" should appear, not both "tu" and "tu?"
    const tuVariants = wordBank.filter(
      (option) => option.word.toLowerCase().replaceAll(/[^\p{L}\p{N}\s]/gu, "") === "tu",
    );

    expect(tuVariants).toHaveLength(1);
  });

  test("non-reading/listening steps return empty wordBankOptions", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 112,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "test", title: "Test", variant: "text" },
      isPublished: true,
      kind: "static",
      position: 0,
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 112 });
    const stepsWithTranslations = attachTranslationsToSteps(raw!.steps, [], []);
    const result = prepareActivityData({ ...raw!, steps: stepsWithTranslations }, [], []);

    expect(result.steps[0]?.wordBankOptions).toEqual([]);
  });

  test("sentenceWordOptions contains target-language words with metadata for reading steps", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(90),
      kind: "reading",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(91),
          kind: "reading",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(92),
            romanization: null,
            sentence: "gato bonito",
            translation: "pretty cat",
          },
          word: null,
        },
      ],
      title: "Sentence Word Options Reading",
    };

    const lessonWords = [
      {
        audioUrl: "https://example.com/gato.mp3",
        distractorUnsafeTranslations: [],
        id: BigInt(93),
        pronunciation: null,
        romanization: "ga-to",
        translation: "cat",
        word: "gato",
      },
    ];

    const result = prepareActivityData(activity, lessonWords, []);
    const sentenceWordOptions = result.steps[0]?.sentenceWordOptions ?? [];

    expect(sentenceWordOptions).toHaveLength(2);
    expect(sentenceWordOptions[0]).toEqual({
      audioUrl: "https://example.com/gato.mp3",
      romanization: "ga-to",
      translation: "cat",
      word: "gato",
    });
    expect(sentenceWordOptions[1]).toEqual({
      audioUrl: null,
      romanization: null,
      translation: null,
      word: "bonito",
    });
  });

  test("sentenceWordOptions contains target-language words with metadata for listening steps", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(94),
      kind: "listening",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {},
          id: BigInt(95),
          kind: "listening",
          position: 0,
          sentence: {
            audioUrl: null,
            distractorUnsafeSentences: [],
            distractorUnsafeTranslations: [],
            explanation: null,
            id: BigInt(96),
            romanization: null,
            sentence: "gato bonito",
            translation: "pretty cat",
          },
          word: null,
        },
      ],
      title: "Sentence Word Options Listening",
    };

    const sentenceWords = [
      {
        audioUrl: "https://example.com/sw-gato.mp3",
        distractorUnsafeTranslations: [],
        id: BigInt(97),
        pronunciation: null,
        romanization: "ga-to-sw",
        translation: "cat (sw)",
        word: "gato",
      },
    ];

    const result = prepareActivityData(activity, [], [], sentenceWords);
    const sentenceWordOptions = result.steps[0]?.sentenceWordOptions ?? [];

    expect(sentenceWordOptions).toHaveLength(2);
    expect(sentenceWordOptions[0]).toEqual({
      audioUrl: "https://example.com/sw-gato.mp3",
      romanization: "ga-to-sw",
      translation: null,
      word: "gato",
    });
    expect(sentenceWordOptions[1]).toEqual({
      audioUrl: null,
      romanization: null,
      translation: null,
      word: "bonito",
    });
  });

  test("sentenceWordOptions is empty for non-sentence steps", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(98),
      kind: "explanation",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: { text: "test", title: "Test", variant: "text" },
          id: BigInt(99),
          kind: "static",
          position: 0,
          sentence: null,
          word: null,
        },
      ],
      title: "No Sentence",
    };

    const result = prepareActivityData(activity, [], []);
    expect(result.steps[0]?.sentenceWordOptions).toEqual([]);
  });

  test("sortOrder step populates sortOrderItems with all items", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(50),
      kind: "explanation",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {
            feedback: "Good",
            items: ["First", "Second", "Third"],
            question: "Order these",
          },
          id: BigInt(51),
          kind: "sortOrder",
          position: 0,
          sentence: null,
          word: null,
        },
      ],
      title: "Sort Order",
    };

    const result = prepareActivityData(activity, [], []);
    const step = result.steps[0];

    expect(step?.sortOrderItems).toHaveLength(3);
    expect(step?.sortOrderItems.toSorted()).toEqual(["First", "Second", "Third"]);
  });

  test("fillBlank step populates fillBlankOptions with answers and distractors", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(52),
      kind: "explanation",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {
            answers: ["alpha", "beta"],
            distractors: ["gamma", "delta"],
            feedback: "Nice",
            template: "Say [BLANK] then [BLANK]",
          },
          id: BigInt(53),
          kind: "fillBlank",
          position: 0,
          sentence: null,
          word: null,
        },
      ],
      title: "Fill Blank",
    };

    const result = prepareActivityData(activity, [], []);
    const step = result.steps[0];

    expect(step?.fillBlankOptions).toHaveLength(4);
    expect(step?.fillBlankOptions.map((option) => option.word).toSorted()).toEqual([
      "alpha",
      "beta",
      "delta",
      "gamma",
    ]);
  });

  test("matchColumns step populates matchColumnsRightItems with right-column values", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(54),
      kind: "explanation",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: {
            pairs: [
              { left: "A", right: "1" },
              { left: "B", right: "2" },
              { left: "C", right: "3" },
            ],
            question: "Match these",
          },
          id: BigInt(55),
          kind: "matchColumns",
          position: 0,
          sentence: null,
          word: null,
        },
      ],
      title: "Match Columns",
    };

    const result = prepareActivityData(activity, [], []);
    const step = result.steps[0];

    expect(step?.matchColumnsRightItems).toHaveLength(3);
    expect(step?.matchColumnsRightItems.toSorted()).toEqual(["1", "2", "3"]);
  });

  test("non-matching step kinds return empty arrays for sortOrderItems, fillBlankOptions, matchColumnsRightItems", () => {
    const activity = {
      description: null,
      generationRunId: null,
      generationStatus: "completed",
      id: BigInt(56),
      kind: "explanation",
      language: "en",
      organizationId: 1,
      position: 0,
      steps: [
        {
          content: { text: "test", title: "Test", variant: "text" },
          id: BigInt(57),
          kind: "static",
          position: 0,
          sentence: null,
          word: null,
        },
      ],
      title: "Static",
    };

    const result = prepareActivityData(activity, [], []);
    const step = result.steps[0];

    expect(step?.sortOrderItems).toEqual([]);
    expect(step?.fillBlankOptions).toEqual([]);
    expect(step?.matchColumnsRightItems).toEqual([]);
  });

  test("includes language and organizationId", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 108,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "test", title: "Test", variant: "text" },
      isPublished: true,
      position: 0,
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 108 });
    const stepsWithTranslations = attachTranslationsToSteps(raw!.steps, [], []);
    const result = prepareActivityData({ ...raw!, steps: stepsWithTranslations }, [], []);

    expect(result.language).toBe("en");
    expect(result.organizationId).toBe(org.id);
    expect(result.kind).toBe("explanation");
  });
});
