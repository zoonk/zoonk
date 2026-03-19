import { randomUUID } from "node:crypto";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateActivityGrammar } from "@zoonk/ai/tasks/activities/language/grammar";
import { generateActivitySentenceVariants } from "@zoonk/ai/tasks/activities/language/sentence-variants";
import { generateActivitySentences } from "@zoonk/ai/tasks/activities/language/sentences";
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

vi.mock("./steps/get-neighboring-concepts-step", () => ({
  getNeighboringConceptsStep: vi.fn().mockResolvedValue([]),
}));

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
        {
          alternativeTranslations: ["hi"],
          romanization: "o-la",
          translation: "hello",
          word: "hola",
        },
        { alternativeTranslations: [], romanization: "ga-to", translation: "cat", word: "gato" },
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

vi.mock("@zoonk/ai/tasks/activities/language/sentences", () => ({
  generateActivitySentences: vi.fn().mockResolvedValue({
    data: {
      sentences: [
        {
          explanation: "Basic sentence with verb 'ver' (to see) conjugated for 'yo'.",
          romanization: "yo see-o un ga-to",
          sentence: "Yo veo un gato.",
          translation: "I see a cat.",
        },
        {
          explanation: null,
          romanization: "o-la, ko-mo es-tas",
          sentence: "Hola, ¿cómo estás?",
          translation: "Hello, how are you?",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/sentence-variants", () => ({
  generateActivitySentenceVariants: vi.fn().mockResolvedValue({
    data: {
      sentences: [
        { alternativeSentences: [], alternativeTranslations: [], id: "0" },
        { alternativeSentences: [], alternativeTranslations: [], id: "1" },
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

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue({
    data: { steps: [{ text: "Explanation step 1 text", title: "Explanation Step 1" }] },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/practice", () => ({
  generateActivityPractice: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/challenge", () => ({
  generateActivityChallenge: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/quiz", () => ({
  generateActivityQuiz: vi.fn().mockResolvedValue({ data: { questions: [] } }),
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
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    expect(generateActivityVocabulary).toHaveBeenCalled();
    expect(generateActivityExplanation).not.toHaveBeenCalled();
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
      chapterTitle: chapter.title,
      concepts: [],
      lessonDescription: testLesson.description ?? undefined,
      lessonTitle: testLesson.title,
      neighboringConcepts: [],
      targetLanguage: "es",
      userLanguage: "en",
      words: expectedWords,
    });
    expect(generateActivitySentenceVariants).toHaveBeenCalledWith({
      chapterTitle: chapter.title,
      lessonDescription: testLesson.description ?? undefined,
      lessonTitle: testLesson.title,
      sentences: [
        {
          id: "0",
          sentence: "Yo veo un gato.",
          translation: "I see a cat.",
        },
        {
          id: "1",
          sentence: "Hola, ¿cómo estás?",
          translation: "Hello, how are you?",
        },
      ],
      targetLanguage: "es",
      userLanguage: "en",
    });
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
      expect(listeningStep.isPublished).toBeTruthy();
      expect(listeningStep.sentenceId).toBe(readingSteps[idx]?.sentenceId);
      expect(listeningStep.position).toBe(readingSteps[idx]?.position);
      expect(listeningStep.kind).toBe("listening");
      expect(listeningStep.content).toEqual({});
    });
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
    expect(generateActivitySentenceVariants).not.toHaveBeenCalled();
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
    expect(generateActivitySentenceVariants).not.toHaveBeenCalled();

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
});
