import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSentenceFixture } from "@zoonk/testing/fixtures/lesson-sentences";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, expectTypeOf, test } from "vitest";
import { getActivity } from "./get-activity";
import { type LessonSentenceData } from "./get-lesson-sentences";
import { type LessonWordData } from "./get-lesson-words";
import { prepareActivityData } from "./prepare-activity-data";

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
      kind: "background",
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
    const result = prepareActivityData(raw!, [], []);

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
      kind: "background",
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
    const result = prepareActivityData(raw!, [], []);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.kind).toBe("static");
    expect(result.steps[0]?.content).toEqual({
      text: "Hello world",
      title: "Intro",
      variant: "text",
    });
  });

  test("parses visual content when present", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 102,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "Code example", title: "Code", variant: "text" },
      isPublished: true,
      kind: "static",
      position: 0,
      visualContent: { code: "console.log('hi')", language: "javascript" },
      visualKind: "code",
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 102 });
    const result = prepareActivityData(raw!, [], []);

    expect(result.steps[0]?.visualKind).toBe("code");
    expect(result.steps[0]?.visualContent).toEqual({
      code: "console.log('hi')",
      language: "javascript",
    });
  });

  test("returns null visualContent for unsupported visual kinds", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 103,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "Audio step", title: "Audio", variant: "text" },
      isPublished: true,
      kind: "static",
      position: 0,
      visualContent: { src: "audio.mp3" },
      visualKind: "audio",
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 103 });
    const result = prepareActivityData(raw!, [], []);

    expect(result.steps[0]?.visualKind).toBeNull();
    expect(result.steps[0]?.visualContent).toBeNull();
  });

  test("serializes word data on steps with word relations", async () => {
    const [word, activity] = await Promise.all([
      wordFixture({
        audioUrl: "https://example.com/word.mp3",
        organizationId: org.id,
        pronunciation: "hola",
        romanization: null,
        translation: "hello",
        word: `hola-${crypto.randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        language: "en",
        lessonId: lesson.id,
        organizationId: org.id,
        position: 104,
      }),
    ]);

    await stepFixture({
      activityId: activity.id,
      content: {},
      isPublished: true,
      kind: "vocabulary",
      position: 0,
      wordId: word.id,
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 104 });
    const result = prepareActivityData(raw!, [], []);

    expect(result.steps[0]?.word).toEqual({
      audioUrl: "https://example.com/word.mp3",
      id: String(word.id),
      pronunciation: "hola",
      romanization: null,
      translation: "hello",
      word: word.word,
    });
  });

  test("serializes sentence data on steps with sentence relations", async () => {
    const [sentence, activity] = await Promise.all([
      sentenceFixture({
        audioUrl: "https://example.com/sent.mp3",
        organizationId: org.id,
        romanization: "konnichiwa",
        sentence: `konnichiwa-${crypto.randomUUID()}`,
        translation: "hello",
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "reading",
        language: "en",
        lessonId: lesson.id,
        organizationId: org.id,
        position: 105,
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

    const raw = await getActivity({ lessonId: lesson.id, position: 105 });
    const result = prepareActivityData(raw!, [], []);

    expect(result.steps[0]?.sentence).toEqual({
      audioUrl: "https://example.com/sent.mp3",
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
      kind: "background",
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
    const result = prepareActivityData(raw!, [], []);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.kind).toBe("static");
  });

  test("includes lesson word and sentence pools", async () => {
    const [word1, word2, sentence1] = await Promise.all([
      wordFixture({ organizationId: org.id }),
      wordFixture({ organizationId: org.id }),
      sentenceFixture({ organizationId: org.id }),
    ]);

    await Promise.all([
      lessonWordFixture({ lessonId: lesson.id, wordId: word1.id }),
      lessonWordFixture({ lessonId: lesson.id, wordId: word2.id }),
      lessonSentenceFixture({ lessonId: lesson.id, sentenceId: sentence1.id }),
    ]);

    const lessonWords: LessonWordData[] = [
      {
        audioUrl: word1.audioUrl,
        id: word1.id,
        pronunciation: word1.pronunciation,
        romanization: word1.romanization,
        translation: word1.translation,
        word: word1.word,
      },
      {
        audioUrl: word2.audioUrl,
        id: word2.id,
        pronunciation: word2.pronunciation,
        romanization: word2.romanization,
        translation: word2.translation,
        word: word2.word,
      },
    ];

    const lessonSentences: LessonSentenceData[] = [
      {
        audioUrl: sentence1.audioUrl,
        id: sentence1.id,
        romanization: sentence1.romanization,
        sentence: sentence1.sentence,
        translation: sentence1.translation,
      },
    ];

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 107,
    });

    await stepFixture({
      activityId: activity.id,
      content: {},
      isPublished: true,
      kind: "vocabulary",
      position: 0,
    });

    const raw = await getActivity({ lessonId: lesson.id, position: 107 });
    const result = prepareActivityData(raw!, lessonWords, lessonSentences);

    expect(result.lessonWords).toHaveLength(2);
    expect(result.lessonWords[0]?.id).toBe(String(word1.id));
    expect(result.lessonWords[1]?.id).toBe(String(word2.id));
    expect(result.lessonSentences).toHaveLength(1);
    expect(result.lessonSentences[0]?.id).toBe(String(sentence1.id));
  });

  test("shuffles multiple choice options without losing or duplicating elements", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
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
    const result = prepareActivityData(raw!, [], []);

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

  test("includes language and organizationId", async () => {
    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
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
    const result = prepareActivityData(raw!, [], []);

    expect(result.language).toBe("en");
    expect(result.organizationId).toBe(org.id);
    expect(result.kind).toBe("background");
  });
});
