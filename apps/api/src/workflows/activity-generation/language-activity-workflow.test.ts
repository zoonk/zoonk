import { randomUUID } from "node:crypto";
import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { generateActivityVocabulary } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "./activity-generation-workflow";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/vocabulary", () => ({
  generateActivityVocabulary: vi.fn().mockResolvedValue({
    data: {
      words: [
        { romanization: "o-la", translation: "hello", word: "hola" },
        { romanization: "ga-to", translation: "cat", word: "gato" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/pronunciation", () => ({
  generateActivityPronunciation: vi.fn().mockResolvedValue({
    data: { pronunciation: "OH-lah" },
  }),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi.fn().mockResolvedValue({
    data: "https://example.com/audio.mp3",
    error: null,
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/background", () => ({
  generateActivityBackground: vi.fn().mockResolvedValue({
    data: { steps: [{ text: "Background step 1 text", title: "Background Step 1" }] },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/mechanics", () => ({
  generateActivityMechanics: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/examples", () => ({
  generateActivityExamples: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/story", () => ({
  generateActivityStory: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/challenge", () => ({
  generateActivityChallenge: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/review", () => ({
  generateActivityReview: vi.fn().mockResolvedValue({ data: { questions: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation-quiz", () => ({
  generateActivityExplanationQuiz: vi.fn().mockResolvedValue({ data: { questions: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/custom", () => ({
  generateActivityCustom: vi.fn().mockResolvedValue({
    data: { steps: [{ text: "Custom step 1 text", title: "Custom Step 1" }] },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/visual", () => ({
  generateStepVisuals: vi.fn().mockResolvedValue({ data: { visuals: [] } }),
}));

vi.mock("@zoonk/core/steps/visual-image", () => ({
  generateVisualStepImage: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock("@zoonk/core/cache/revalidate", () => ({
  revalidateMainApp: vi.fn().mockResolvedValue(null),
}));

describe("vocabulary activity generation", () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId, targetLanguage: "es" });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Test Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("doesn't call generateActivityVocabulary when lesson has no vocabulary activities", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Lang No Vocab ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Background ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityVocabulary).not.toHaveBeenCalled();
  });

  test("calls generateActivityVocabulary with correct params", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      description: "Learn basic greetings",
      kind: "language",
      organizationId,
      title: `Vocab Params ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityVocabulary).toHaveBeenCalledWith({
      chapterTitle: chapter.title,
      courseTitle: course.title,
      language: "en",
      lessonDescription: "Learn basic greetings",
      lessonTitle: testLesson.title,
    });
  });

  test("creates word records in the words table with correct targetLanguage and userLanguage", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Words ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const words = await prisma.word.findMany({
      where: {
        organizationId,
        steps: { some: { activityId: activity.id } },
        targetLanguage: "es",
        userLanguage: "en",
      },
    });

    expect(words).toHaveLength(2);
    expect(words.map((word) => word.word).toSorted()).toEqual(["gato", "hola"]);
  });

  test("creates lesson_words junction records for each word", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab LessonWords ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const lessonWords = await prisma.lessonWord.findMany({
      where: { lessonId: testLesson.id },
    });

    expect(lessonWords).toHaveLength(2);
  });

  test("creates steps with wordId links and empty content", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const steps = await prisma.step.findMany({
      include: { word: true },
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.wordId).not.toBeNull();
      expect(step.kind).toBe("static");
      expect(step.content).toEqual({});
    }

    const wordNames = steps.map((step) => step.word?.word);
    expect(wordNames).toHaveLength(2);
    expect(wordNames).toContain("hola");
    expect(wordNames).toContain("gato");

    const holaStep = steps.find((step) => step.word?.word === "hola");
    expect(holaStep?.word?.translation).toBe("hello");
  });

  test("calls generateActivityPronunciation once per word with correct params", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Pron ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityPronunciation).toHaveBeenCalledTimes(2);
    expect(generateActivityPronunciation).toHaveBeenCalledWith({
      nativeLanguage: "en",
      targetLanguage: "es",
      word: "hola",
    });
    expect(generateActivityPronunciation).toHaveBeenCalledWith({
      nativeLanguage: "en",
      targetLanguage: "es",
      word: "gato",
    });
  });

  test("calls generateLanguageAudio once per word when targetLanguage supports TTS", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Audio ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateLanguageAudio).toHaveBeenCalledTimes(2);
    expect(generateLanguageAudio).toHaveBeenCalledWith({
      language: "es",
      orgSlug: "ai",
      text: "hola",
    });
    expect(generateLanguageAudio).toHaveBeenCalledWith({
      language: "es",
      orgSlug: "ai",
      text: "gato",
    });
  });

  test("does not call generateLanguageAudio when targetLanguage does not support TTS", async () => {
    const unsupportedCourse = await courseFixture({
      organizationId,
      targetLanguage: "xx",
    });

    const unsupportedChapter = await chapterFixture({
      courseId: unsupportedCourse.id,
      organizationId,
      title: `Unsupported Chapter ${randomUUID()}`,
    });

    const testLesson = await lessonFixture({
      chapterId: unsupportedChapter.id,
      kind: "language",
      organizationId,
      title: `Vocab NoTTS ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateLanguageAudio).not.toHaveBeenCalled();
    expect(generateActivityPronunciation).toHaveBeenCalledTimes(2);
  });

  test("updates word records with pronunciation and audioUrl", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Enrich ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const words = await prisma.word.findMany({
      where: { steps: { some: { activityId: activity.id } } },
    });

    for (const word of words) {
      expect(word.pronunciation).toBe("OH-lah");
      expect(word.audioUrl).toBe("https://example.com/audio.mp3");
    }
  });

  test("sets activity generationStatus to 'completed' with generationRunId", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets activity to 'failed' when generateActivityVocabulary throws", async () => {
    vi.mocked(generateActivityVocabulary).mockRejectedValueOnce(new Error("AI failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets activity to 'failed' when generateActivityPronunciation fails for all words", async () => {
    vi.mocked(generateActivityPronunciation)
      .mockRejectedValueOnce(new Error("Pronunciation failed"))
      .mockRejectedValueOnce(new Error("Pronunciation failed"));

    // Use unique targetLanguage to avoid shared word records from other tests
    const pronFailCourse = await courseFixture({ organizationId, targetLanguage: "fr" });
    const pronFailChapter = await chapterFixture({
      courseId: pronFailCourse.id,
      organizationId,
      title: `PronFail Chapter ${randomUUID()}`,
    });

    const testLesson = await lessonFixture({
      chapterId: pronFailChapter.id,
      kind: "language",
      organizationId,
      title: `Vocab PronFail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets activity to 'failed' when generateLanguageAudio fails for all words", async () => {
    vi.mocked(generateLanguageAudio)
      .mockResolvedValueOnce({ data: null, error: new Error("Audio failed") })
      .mockResolvedValueOnce({ data: null, error: new Error("Audio failed") });

    // Use unique targetLanguage to avoid shared word records from other tests
    const audioFailCourse = await courseFixture({ organizationId, targetLanguage: "de" });
    const audioFailChapter = await chapterFixture({
      courseId: audioFailCourse.id,
      organizationId,
      title: `AudioFail Chapter ${randomUUID()}`,
    });

    const testLesson = await lessonFixture({
      chapterId: audioFailChapter.id,
      kind: "language",
      organizationId,
      title: `Vocab AudioFail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets activity to 'failed' when AI returns empty words", async () => {
    vi.mocked(generateActivityVocabulary).mockResolvedValueOnce({
      data: { words: [] },
      systemPrompt: "",
      usage: {
        inputTokenDetails: {
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
          noCacheTokens: undefined,
        },
        inputTokens: 0,
        outputTokenDetails: { reasoningTokens: undefined, textTokens: undefined },
        outputTokens: 0,
        totalTokens: 0,
      },
      userPrompt: "",
    });

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab EmptyAI ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets activity to 'failed' when word saving fails", async () => {
    const saveStepModule = await import("./steps/save-vocabulary-words-step");
    const spy = vi
      .spyOn(saveStepModule, "saveVocabularyWordsStep")
      .mockRejectedValueOnce(new Error("DB error"));

    try {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        kind: "language",
        organizationId,
        title: `Vocab SaveFail ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "vocabulary",
        lessonId: testLesson.id,
        organizationId,
        title: `Vocabulary ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      expect(dbActivity?.generationStatus).toBe("failed");
    } finally {
      spy.mockRestore();
    }
  });

  test("skips vocabulary generation if activity is already completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityVocabulary).not.toHaveBeenCalled();
  });

  test("does not process non-vocabulary activities", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Only ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Background ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityVocabulary).toHaveBeenCalled();

    const { generateActivityBackground } =
      await import("@zoonk/ai/tasks/activities/core/background");
    expect(generateActivityBackground).not.toHaveBeenCalled();
  });
});
