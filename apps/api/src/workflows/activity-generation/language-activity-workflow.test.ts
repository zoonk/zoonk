import { randomUUID } from "node:crypto";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateActivityGrammarContent } from "@zoonk/ai/tasks/activities/language/grammar-content";
import { generateActivitySentenceDistractorUnsafeVariants } from "@zoonk/ai/tasks/activities/language/sentence-distractor-unsafe-variants";
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
import { getLessonActivitiesStep } from "./steps/get-lesson-activities-step";
import { saveListeningActivityStep } from "./steps/save-listening-activity-step";

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
        { translation: "hello", word: "hola" },
        { translation: "cat", word: "gato" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/grammar-content", () => ({
  generateActivityGrammarContent: vi.fn().mockResolvedValue({
    data: {
      examples: [
        {
          highlight: "hablo",
          sentence: "Yo hablo español.",
        },
        {
          highlight: "comes",
          sentence: "Tú comes pan.",
        },
      ],
      exercises: [
        {
          answer: "hablo",
          distractors: ["hablas", "habla"],
          template: "Yo [BLANK] español.",
        },
        {
          answer: "comes",
          distractors: ["como", "come"],
          template: "Tú [BLANK] pan.",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/grammar-user-content", () => ({
  generateActivityGrammarUserContent: vi.fn().mockResolvedValue({
    data: {
      discovery: {
        context: null,
        options: [
          { feedback: "Correct", isCorrect: true, text: "Pattern A" },
          { feedback: "Try again", isCorrect: false, text: "Pattern B" },
        ],
        question: null,
      },
      exampleTranslations: ["I speak Spanish.", "You eat bread."],
      exerciseFeedback: [
        "First person singular ends with -o.",
        "Second person singular ends with -es.",
      ],
      exerciseQuestions: [null, null],
      exerciseTranslations: ["I [BLANK] Spanish.", "You [BLANK] bread."],
      ruleName: "Present tense endings",
      ruleSummary: "Use -o for yo and -es for tú in regular -er verbs.",
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/romanization", () => ({
  generateActivityRomanization: vi.fn().mockResolvedValue({
    data: { romanizations: [] },
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

vi.mock("@zoonk/ai/tasks/activities/language/sentence-distractor-unsafe-variants", () => ({
  generateActivitySentenceDistractorUnsafeVariants: vi.fn().mockResolvedValue({
    data: {
      sentences: [
        { distractorUnsafeSentences: [], distractorUnsafeTranslations: [], id: "0" },
        { distractorUnsafeSentences: [], distractorUnsafeTranslations: [], id: "1" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/translation", () => ({
  generateTranslation: vi.fn().mockResolvedValue({
    data: { translation: "mocked" },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/pronunciation", () => ({
  generateActivityPronunciation: vi.fn().mockResolvedValue({
    data: { pronunciation: "OH-lah" },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/word-distractor-unsafe-translations", () => ({
  generateWordDistractorUnsafeTranslations: vi.fn().mockResolvedValue({
    data: { distractorUnsafeTranslations: [] },
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
        word: `gato-${randomUUID().slice(0, 8)}`,
      },
    });

    const word2 = await prisma.word.create({
      data: {
        organizationId,
        romanization: "o-la",
        targetLanguage,
        word: `hola-${randomUUID().slice(0, 8)}`,
      },
    });

    await prisma.lessonWord.createMany({
      data: [
        { lessonId, translation: "cat", userLanguage, wordId: word1.id },
        { lessonId, translation: "hello", userLanguage, wordId: word2.id },
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

    expect(generateActivityGrammarContent).toHaveBeenCalledOnce();

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
    expect(generateActivitySentenceDistractorUnsafeVariants).toHaveBeenCalledWith({
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
      expect(listeningStep.isPublished).toBe(true);
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

    // Create a reading step so the listening step has source data to copy
    const sentence = await prisma.sentence.create({
      data: {
        organizationId,
        sentence: `listen-running-${randomUUID().slice(0, 8)}`,
        targetLanguage: "es",
      },
    });

    await prisma.step.create({
      data: {
        activityId: readingActivity.id,
        content: {},
        kind: "reading",
        position: 0,
        sentenceId: sentence.id,
      },
    });

    // Listening must be "pending" (not "running") because saveListeningActivityStep
    // skips activities that are already "running" or "completed".
    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      lessonId: testLesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await saveListeningActivityStep(activities, "test-run-id");

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
    expect(generateActivitySentenceDistractorUnsafeVariants).not.toHaveBeenCalled();
  });

  test("reading completes without audio when audio generation fails", async () => {
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

    // Audio failure is graceful: the audio step returns empty URLs,
    // the save step persists sentences without audio, and both activities complete.
    expect(dbReading?.generationStatus).toBe("completed");
    expect(dbListening?.generationStatus).toBe("completed");
  });

  test("regenerates translation when vocabulary is completed but translation failed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Trans Regen ${randomUUID()}`,
    });

    // Vocabulary: already completed with steps in DB
    const vocabActivity = await activityFixture({
      generationStatus: "completed",
      kind: "vocabulary",
      language: "en",
      lessonId: testLesson.id,
      organizationId,
      position: 0,
      title: `Vocabulary ${randomUUID()}`,
    });

    // Create vocabulary steps with word references (simulates prior completed run)
    const word1 = await prisma.word.create({
      data: {
        organizationId,
        targetLanguage: "es",
        word: `regen-word-1-${randomUUID().slice(0, 8)}`,
      },
    });

    const word2 = await prisma.word.create({
      data: {
        organizationId,
        targetLanguage: "es",
        word: `regen-word-2-${randomUUID().slice(0, 8)}`,
      },
    });

    await prisma.step.createMany({
      data: [
        {
          activityId: vocabActivity.id,
          content: {},
          isPublished: true,
          kind: "vocabulary",
          position: 0,
          wordId: word1.id,
        },
        {
          activityId: vocabActivity.id,
          content: {},
          isPublished: true,
          kind: "vocabulary",
          position: 1,
          wordId: word2.id,
        },
      ],
    });

    // Translation: failed on prior run
    const transActivity = await activityFixture({
      generationStatus: "failed",
      kind: "translation",
      language: "en",
      lessonId: testLesson.id,
      organizationId,
      position: 1,
      title: `Translation ${randomUUID()}`,
    });

    await activityGenerationWorkflow(testLesson.id);

    // Vocabulary AI should NOT be called (vocabulary is already completed)
    expect(generateActivityVocabulary).not.toHaveBeenCalled();

    // Translation steps should be created from the existing vocabulary steps
    const transSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: transActivity.id },
    });

    expect(transSteps).toHaveLength(2);
    expect(transSteps[0]?.kind).toBe("translation");
    expect(transSteps[0]?.wordId).toBe(word1.id);
    expect(transSteps[1]?.kind).toBe("translation");
    expect(transSteps[1]?.wordId).toBe(word2.id);

    const dbTrans = await prisma.activity.findUnique({
      where: { id: transActivity.id },
    });
    expect(dbTrans?.generationStatus).toBe("completed");
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
      },
    });

    await prisma.lessonSentence.create({
      data: {
        lessonId: testLesson.id,
        sentenceId: sentence1.id,
        translation: "Pre-complete sentence 1",
        userLanguage: "en",
      },
    });

    const sentence2 = await prisma.sentence.create({
      data: {
        organizationId,
        sentence: `pre-complete-sentence-2-${randomUUID().slice(0, 8)}`,
        targetLanguage: "es",
      },
    });

    await prisma.lessonSentence.create({
      data: {
        lessonId: testLesson.id,
        sentenceId: sentence2.id,
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
    expect(generateActivitySentenceDistractorUnsafeVariants).not.toHaveBeenCalled();

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
