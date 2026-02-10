import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateActivityGrammar } from "@zoonk/ai/tasks/activities/language/grammar";
import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { generateActivitySentences } from "@zoonk/ai/tasks/activities/language/sentences";
import { generateActivityStoryLanguage } from "@zoonk/ai/tasks/activities/language/story";
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
import { completeListeningActivityStep } from "./steps/complete-listening-activity-step";
import { getLessonActivitiesStep } from "./steps/get-lesson-activities-step";

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

vi.mock("@zoonk/ai/tasks/activities/language/grammar", () => ({
  generateActivityGrammar: vi.fn().mockResolvedValue({
    data: {
      discovery: {
        options: [
          { feedback: "Correct", isCorrect: true, text: "Pattern A" },
          { feedback: "Try again", isCorrect: false, text: "Pattern B" },
        ],
      },
      examples: [
        {
          highlight: "hablo",
          romanization: "ha-blo",
          sentence: "Yo hablo español.",
          translation: "I speak Spanish.",
        },
        {
          highlight: "comes",
          romanization: "co-mes",
          sentence: "Tú comes pan.",
          translation: "You eat bread.",
        },
      ],
      exercises: [
        {
          answers: ["hablo"],
          distractors: ["hablas", "habla"],
          feedback: "First person singular ends with -o.",
          template: "Yo [BLANK] español.",
        },
        {
          answers: ["comes"],
          distractors: ["como", "come"],
          feedback: "Second person singular ends with -es.",
          template: "Tú [BLANK] pan.",
        },
      ],
      ruleName: "Present tense endings",
      ruleSummary: "Use -o for yo and -es for tú in regular -er verbs.",
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/story", () => ({
  generateActivityStoryLanguage: vi.fn().mockResolvedValue({
    data: {
      scenario:
        "You're in a Madrid bakery and need to order politely while the clerk asks follow-up questions.",
      steps: [
        {
          context: "The clerk smiles and asks what you'd like to drink.",
          contextRomanization: "The clerk smiles and asks what you'd like to drink.",
          contextTranslation: "The clerk smiles and asks what you'd like to drink.",
          options: [
            {
              feedback: "Perfectly polite and natural.",
              isCorrect: true,
              text: "Buenos días, quisiera un café con leche, por favor.",
              textRomanization: "bweh-nos dee-as kee-sye-ra oon ka-fe kon leh-che por fa-bor",
            },
            {
              feedback: "Understandable, but too abrupt.",
              isCorrect: false,
              text: "Dame café.",
              textRomanization: "da-me ka-fe",
            },
            {
              feedback: "This asks for tea, not coffee.",
              isCorrect: false,
              text: "Quiero té.",
              textRomanization: "kye-ro te",
            },
            {
              feedback: "Wrong context and meaning.",
              isCorrect: false,
              text: "¿Dónde está el baño?",
              textRomanization: "don-de es-ta el ba-nyo",
            },
          ],
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/sentences", () => ({
  generateActivitySentences: vi.fn().mockResolvedValue({
    data: {
      sentences: [
        {
          romanization: "yo see-o un ga-to",
          sentence: "Yo veo un gato.",
          translation: "I see a cat.",
        },
        {
          romanization: "o-la, ko-mo es-tas",
          sentence: "Hola, ¿cómo estás?",
          translation: "Hello, how are you?",
        },
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

describe("language activity generation", () => {
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

  async function createLessonWordsForReading(input: {
    lessonId: number;
    targetLanguage: string;
    userLanguage?: string;
  }) {
    const { lessonId, targetLanguage, userLanguage = "en" } = input;

    const word1 = await prisma.word.create({
      data: {
        organizationId,
        romanization: "ga-to",
        targetLanguage,
        translation: "cat",
        userLanguage,
        word: `gato-${randomUUID().slice(0, 8)}`,
      },
    });

    const word2 = await prisma.word.create({
      data: {
        organizationId,
        romanization: "o-la",
        targetLanguage,
        translation: "hello",
        userLanguage,
        word: `hola-${randomUUID().slice(0, 8)}`,
      },
    });

    await prisma.lessonWord.createMany({
      data: [
        { lessonId, wordId: word1.id },
        { lessonId, wordId: word2.id },
      ],
    });

    return [word1.word, word2.word];
  }

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

  test("calls generateActivityVocabulary with targetLanguage and userLanguage", async () => {
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
      lessonDescription: "Learn basic greetings",
      lessonTitle: testLesson.title,
      targetLanguage: "es",
      userLanguage: "en",
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

  test("creates steps with wordId links and vocabularyWordRef content", async () => {
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
      expect(step.kind).toBe("vocabulary");
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
      targetLanguage: "es",
      userLanguage: "en",
      word: "hola",
    });
    expect(generateActivityPronunciation).toHaveBeenCalledWith({
      targetLanguage: "es",
      userLanguage: "en",
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
    vi.mocked(generateActivityVocabulary).mockResolvedValueOnce(
      // oxlint-disable-next-line no-unsafe-type-assertion -- test: only data.words is read
      { data: { words: [] } } as unknown as Awaited<ReturnType<typeof generateActivityVocabulary>>,
    );

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
    expect(generateActivityBackground).not.toHaveBeenCalled();
  });

  test("calls generateActivityGrammar with targetLanguage and userLanguage", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      description: "Learn present tense in Spanish",
      kind: "language",
      organizationId,
      title: `Grammar Params ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      lessonId: testLesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityGrammar).toHaveBeenCalledWith({
      chapterTitle: chapter.title,
      lessonDescription: "Learn present tense in Spanish",
      lessonTitle: testLesson.title,
      targetLanguage: "es",
      userLanguage: "en",
    });
  });

  test("creates grammar steps in order with expected kinds and content", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      lessonId: testLesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(6);

    expect(steps.map((step) => step.kind)).toEqual([
      "static",
      "static",
      "multipleChoice",
      "static",
      "fillBlank",
      "fillBlank",
    ]);

    expect(steps[0]?.content).toEqual({
      highlight: "hablo",
      romanization: "ha-blo",
      sentence: "Yo hablo español.",
      translation: "I speak Spanish.",
      variant: "grammarExample",
    });

    expect(steps[2]?.content).toEqual({
      kind: "core",
      options: [
        { feedback: "Correct", isCorrect: true, text: "Pattern A" },
        { feedback: "Try again", isCorrect: false, text: "Pattern B" },
      ],
    });

    expect(steps[3]?.content).toEqual({
      ruleName: "Present tense endings",
      ruleSummary: "Use -o for yo and -es for tú in regular -er verbs.",
      variant: "grammarRule",
    });

    expect(steps[4]?.content).toEqual({
      answers: ["hablo"],
      distractors: ["hablas", "habla"],
      feedback: "First person singular ends with -o.",
      template: "Yo [BLANK] español.",
    });
  });

  test("sets grammar activity generationStatus to 'completed' with generationRunId", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      lessonId: testLesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets grammar activity to 'failed' when generateActivityGrammar throws", async () => {
    vi.mocked(generateActivityGrammar).mockRejectedValueOnce(new Error("Grammar AI failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      lessonId: testLesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets grammar activity to 'failed' when grammar payload is empty", async () => {
    vi.mocked(generateActivityGrammar).mockResolvedValueOnce(
      // oxlint-disable-next-line no-unsafe-type-assertion -- test: grammar step validates only data shape
      {
        data: {
          discovery: { options: [] },
          examples: [],
          exercises: [],
          ruleName: "",
          ruleSummary: "",
        },
      } as unknown as Awaited<ReturnType<typeof generateActivityGrammar>>,
    );

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Empty ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      lessonId: testLesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("generates grammar even when vocabulary generation fails", async () => {
    vi.mocked(generateActivityVocabulary).mockRejectedValueOnce(new Error("Vocabulary AI failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Independent ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const grammarActivity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      lessonId: testLesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityGrammar).toHaveBeenCalledOnce();

    const dbGrammarActivity = await prisma.activity.findUnique({
      where: { id: grammarActivity.id },
    });

    expect(dbGrammarActivity?.generationStatus).toBe("completed");
  });

  test("sets language story status to 'running' when generation starts", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LanguageStory Running ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languageStory",
      lessonId: testLesson.id,
      organizationId,
      title: `LanguageStory ${randomUUID()}`,
    });

    let capturedStatus: string | null = null;

    vi.mocked(generateActivityStoryLanguage).mockImplementationOnce(async () => {
      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      capturedStatus = dbActivity?.generationStatus ?? null;

      return {
        data: {
          scenario: "You are at a train station in Madrid.",
          steps: [
            {
              context: "The attendant asks where you want to go.",
              contextRomanization: "The attendant asks where you want to go.",
              contextTranslation: "The attendant asks where you want to go.",
              options: [
                {
                  feedback: "Correct and polite.",
                  isCorrect: true,
                  text: "Quisiera un billete a Toledo, por favor.",
                  textRomanization: "kee-sye-ra oon bee-ye-te a to-le-do por fa-bor",
                },
                {
                  feedback: "Wrong meaning.",
                  isCorrect: false,
                  text: "Estoy cansado.",
                  textRomanization: "es-toy kan-sa-do",
                },
                {
                  feedback: "Irrelevant question.",
                  isCorrect: false,
                  text: "¿Qué hora es?",
                  textRomanization: "ke o-ra es",
                },
                {
                  feedback: "Too informal and unclear.",
                  isCorrect: false,
                  text: "Toledo.",
                  textRomanization: "to-le-do",
                },
              ],
            },
          ],
        },
      } as Awaited<ReturnType<typeof generateActivityStoryLanguage>>;
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(capturedStatus).toBe("running");
  });

  test("calls generateActivityStoryLanguage with targetLanguage and userLanguage", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      description: "Practice ordering in a cafe",
      kind: "language",
      organizationId,
      title: `LanguageStory Params ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "languageStory",
      lessonId: testLesson.id,
      organizationId,
      title: `LanguageStory ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityStoryLanguage).toHaveBeenCalledWith({
      chapterTitle: chapter.title,
      lessonDescription: "Practice ordering in a cafe",
      lessonTitle: testLesson.title,
      targetLanguage: "es",
      userLanguage: "en",
    });
  });

  test("creates language story steps in order with expected kinds and content", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LanguageStory Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languageStory",
      lessonId: testLesson.id,
      organizationId,
      title: `LanguageStory ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);
    expect(steps.map((step) => step.kind)).toEqual(["static", "multipleChoice"]);

    expect(steps[0]?.content).toEqual({
      text: "You're in a Madrid bakery and need to order politely while the clerk asks follow-up questions.",
      title: "Scenario",
      variant: "text",
    });

    expect(steps[1]?.content).toEqual({
      context: "The clerk smiles and asks what you'd like to drink.",
      contextRomanization: "The clerk smiles and asks what you'd like to drink.",
      contextTranslation: "The clerk smiles and asks what you'd like to drink.",
      kind: "language",
      options: [
        {
          feedback: "Perfectly polite and natural.",
          isCorrect: true,
          text: "Buenos días, quisiera un café con leche, por favor.",
          textRomanization: "bweh-nos dee-as kee-sye-ra oon ka-fe kon leh-che por fa-bor",
        },
        {
          feedback: "Understandable, but too abrupt.",
          isCorrect: false,
          text: "Dame café.",
          textRomanization: "da-me ka-fe",
        },
        {
          feedback: "This asks for tea, not coffee.",
          isCorrect: false,
          text: "Quiero té.",
          textRomanization: "kye-ro te",
        },
        {
          feedback: "Wrong context and meaning.",
          isCorrect: false,
          text: "¿Dónde está el baño?",
          textRomanization: "don-de es-ta el ba-nyo",
        },
      ],
    });
  });

  test("sets language story activity generationStatus to completed with generationRunId", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LanguageStory Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languageStory",
      lessonId: testLesson.id,
      organizationId,
      title: `LanguageStory ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets language story activity to failed on generation error", async () => {
    vi.mocked(generateActivityStoryLanguage).mockRejectedValueOnce(
      new Error("Language story AI failed"),
    );

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LanguageStory Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languageStory",
      lessonId: testLesson.id,
      organizationId,
      title: `LanguageStory ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("completes language story with empty romanization for Roman-script languages", async () => {
    vi.mocked(generateActivityStoryLanguage).mockResolvedValueOnce({
      data: {
        scenario: "You're at a cafe in Madrid ordering breakfast.",
        steps: [
          {
            context: "Buenos días, ¿qué le pongo?",
            contextRomanization: "",
            contextTranslation: "Good morning, what can I get you?",
            options: [
              {
                feedback: "Perfectly polite and natural.",
                isCorrect: true,
                text: "Un café con leche, por favor.",
                textRomanization: "",
              },
              {
                feedback: "Too abrupt.",
                isCorrect: false,
                text: "Dame café.",
                textRomanization: "",
              },
              {
                feedback: "Wrong item.",
                isCorrect: false,
                text: "Quiero té.",
                textRomanization: "",
              },
              {
                feedback: "Wrong context.",
                isCorrect: false,
                text: "¿Dónde está el baño?",
                textRomanization: "",
              },
            ],
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateActivityStoryLanguage>>);

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LanguageStory EmptyRoman ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languageStory",
      lessonId: testLesson.id,
      organizationId,
      title: `LanguageStory ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);
    expect(steps[1]?.content).toMatchObject({
      contextRomanization: "",
      options: expect.arrayContaining([expect.objectContaining({ textRomanization: "" })]),
    });
  });

  test("sets language story activity to failed when payload is empty", async () => {
    vi.mocked(generateActivityStoryLanguage).mockResolvedValueOnce({
      data: { scenario: "", steps: [] },
    } as unknown as Awaited<ReturnType<typeof generateActivityStoryLanguage>>);

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LanguageStory Empty ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languageStory",
      lessonId: testLesson.id,
      organizationId,
      title: `LanguageStory ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("calls generateActivitySentences with targetLanguage and userLanguage", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Params ${randomUUID()}`,
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
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivitySentences).toHaveBeenCalledWith({
      lessonTitle: testLesson.title,
      targetLanguage: "es",
      userLanguage: "en",
      words: ["hola", "gato"],
    });
  });

  test("falls back to lesson words when reading has no current-run vocabulary words", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Fallback ${randomUUID()}`,
    });

    const expectedWords = await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivitySentences).toHaveBeenCalledWith({
      lessonTitle: testLesson.title,
      targetLanguage: "es",
      userLanguage: "en",
      words: expectedWords,
    });
  });

  test("creates sentence records in sentences table and lesson_sentences junction records", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Sentences ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const sentences = await prisma.sentence.findMany({
      where: {
        lessons: {
          some: {
            lessonId: testLesson.id,
          },
        },
        organizationId,
        targetLanguage: "es",
        userLanguage: "en",
      },
    });

    expect(sentences).toHaveLength(2);
    expect(sentences.map((sentence) => sentence.sentence).toSorted()).toEqual([
      "Hola, ¿cómo estás?",
      "Yo veo un gato.",
    ]);

    const lessonSentences = await prisma.lessonSentence.findMany({
      where: { lessonId: testLesson.id },
    });

    expect(lessonSentences).toHaveLength(2);
  });

  test("creates steps with sentenceId links and readingSentenceRef content", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Steps ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const steps = await prisma.step.findMany({
      include: { sentence: true },
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.sentenceId).not.toBeNull();
      expect(step.kind).toBe("reading");
      expect(step.content).toEqual({});
    }

    expect(steps[0]?.sentence?.sentence).toBe("Yo veo un gato.");
    expect(steps[1]?.sentence?.sentence).toBe("Hola, ¿cómo estás?");
  });

  test("calls generateLanguageAudio once per sentence for reading when targetLanguage supports TTS", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Audio ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateLanguageAudio).toHaveBeenCalledTimes(2);
    expect(generateLanguageAudio).toHaveBeenCalledWith({
      language: "es",
      orgSlug: "ai",
      text: "Yo veo un gato.",
    });
    expect(generateLanguageAudio).toHaveBeenCalledWith({
      language: "es",
      orgSlug: "ai",
      text: "Hola, ¿cómo estás?",
    });
  });

  test("does not call generateLanguageAudio for reading when targetLanguage does not support TTS", async () => {
    const unsupportedCourse = await courseFixture({
      organizationId,
      targetLanguage: "xx",
    });

    const unsupportedChapter = await chapterFixture({
      courseId: unsupportedCourse.id,
      organizationId,
      title: `Unsupported Reading Chapter ${randomUUID()}`,
    });

    const testLesson = await lessonFixture({
      chapterId: unsupportedChapter.id,
      kind: "language",
      organizationId,
      title: `Reading NoTTS ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "xx",
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateLanguageAudio).not.toHaveBeenCalled();
  });

  test("sets reading activity generationStatus to completed with generationRunId", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Complete ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets reading activity to failed when AI returns empty sentences", async () => {
    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      // oxlint-disable-next-line no-unsafe-type-assertion -- test: reading validates only data.sentences
      { data: { sentences: [] } } as unknown as Awaited<
        ReturnType<typeof generateActivitySentences>
      >,
    );

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading EmptyAI ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("creates listening steps that mirror reading steps", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening Mirror ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const readingSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: readingActivity.id, kind: "reading" },
    });

    const listeningSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: listeningActivity.id, kind: "listening" },
    });

    expect(listeningSteps).toHaveLength(readingSteps.length);

    listeningSteps.forEach((listeningStep, idx) => {
      expect(listeningStep.sentenceId).toBe(readingSteps[idx]?.sentenceId);
      expect(listeningStep.position).toBe(readingSteps[idx]?.position);
      expect(listeningStep.kind).toBe("listening");
      expect(listeningStep.content).toEqual({});
    });
  });

  test("sets listening activity to completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening Complete ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
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
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: listeningActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("allows listening completion while reading is still running", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening ReadingRunning ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "running",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "running",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await completeListeningActivityStep(activities, "test-run-id");

    const [dbReading, dbListening] = await Promise.all([
      prisma.activity.findUnique({ where: { id: readingActivity.id } }),
      prisma.activity.findUnique({ where: { id: listeningActivity.id } }),
    ]);

    expect(dbReading?.generationStatus).toBe("running");
    expect(dbListening?.generationStatus).toBe("completed");
    expect(dbListening?.generationRunId).toBe("test-run-id");
  });

  test("sets listening to failed when reading has no steps", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening NoReading ${randomUUID()}`,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: listeningActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("reading fails => listening must not complete", async () => {
    vi.mocked(generateActivitySentences).mockRejectedValueOnce(new Error("Sentences AI failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening ReadFail ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
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
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: listeningActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("reading audio failure causes both reading and listening to fail", async () => {
    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("Audio failed"),
    });

    const audioFailCourse = await courseFixture({ organizationId, targetLanguage: "it" });
    const audioFailChapter = await chapterFixture({
      courseId: audioFailCourse.id,
      organizationId,
      title: `ListenAudioFail Chapter ${randomUUID()}`,
    });

    const testLesson = await lessonFixture({
      chapterId: audioFailChapter.id,
      kind: "language",
      organizationId,
      title: `Listening AudioFail ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "it",
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: testLesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const dbReading = await prisma.activity.findUnique({
      where: { id: readingActivity.id },
    });

    const dbListening = await prisma.activity.findUnique({
      where: { id: listeningActivity.id },
    });

    expect(dbReading?.generationStatus).toBe("failed");
    expect(dbListening?.generationStatus).toBe("failed");
  });

  test("skips listening when activity is already completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening Skip ${randomUUID()}`,
    });

    await createLessonWordsForReading({
      lessonId: testLesson.id,
      targetLanguage: "es",
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "completed",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    const steps = await prisma.step.findMany({
      where: { activityId: listeningActivity.id },
    });

    expect(steps).toHaveLength(0);
  });

  test("copies listening from pre-completed reading without calling AI", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening PreComplete ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "completed",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    // Manually create reading steps in DB to simulate pre-completed reading
    const sentence1 = await prisma.sentence.create({
      data: {
        organizationId,
        sentence: `pre-complete-sentence-1-${randomUUID().slice(0, 8)}`,
        targetLanguage: "es",
        translation: "Pre-complete sentence 1",
        userLanguage: "en",
      },
    });

    const sentence2 = await prisma.sentence.create({
      data: {
        organizationId,
        sentence: `pre-complete-sentence-2-${randomUUID().slice(0, 8)}`,
        targetLanguage: "es",
        translation: "Pre-complete sentence 2",
        userLanguage: "en",
      },
    });

    await prisma.step.createMany({
      data: [
        {
          activityId: readingActivity.id,
          content: {},
          kind: "reading",
          position: 0,
          sentenceId: sentence1.id,
        },
        {
          activityId: readingActivity.id,
          content: {},
          kind: "reading",
          position: 1,
          sentenceId: sentence2.id,
        },
      ],
    });

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivitySentences).not.toHaveBeenCalled();

    const listeningSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: listeningActivity.id, kind: "listening" },
    });

    expect(listeningSteps).toHaveLength(2);
    expect(listeningSteps[0]?.sentenceId).toBe(sentence1.id);
    expect(listeningSteps[1]?.sentenceId).toBe(sentence2.id);

    const dbListening = await prisma.activity.findUnique({
      where: { id: listeningActivity.id },
    });

    expect(dbListening?.generationStatus).toBe("completed");
  });

  test("sets reading activity to failed when no source words are available", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading NoWords ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      lessonId: testLesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivitySentences).not.toHaveBeenCalled();

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });
});
