import { randomUUID } from "node:crypto";
import {
  type VocabularyWord,
  generateActivityVocabulary,
} from "@zoonk/ai/tasks/activities/language/vocabulary";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { vocabularyActivityWorkflow } from "./vocabulary-workflow";

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

vi.mock("@zoonk/ai/tasks/activities/language/pronunciation", () => ({
  generateActivityPronunciation: vi.fn().mockResolvedValue({
    data: { pronunciation: "OH-lah" },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/word-alternative-translations", () => ({
  generateWordAlternativeTranslations: vi.fn().mockResolvedValue({
    data: { alternativeTranslations: [] },
  }),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi.fn().mockResolvedValue({
    data: "https://example.com/audio.mp3",
    error: null,
  }),
}));

async function fetchLessonActivities(lessonId: number): Promise<LessonActivity[]> {
  const activities = await prisma.activity.findMany({
    include: {
      _count: { select: { steps: true } },
      lesson: {
        include: {
          chapter: {
            include: {
              course: { include: { organization: true } },
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: { lessonId },
  });

  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}

describe(vocabularyActivityWorkflow, () => {
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
      title: `Vocab Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates word records and steps with wordId links", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Words ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    const words = await prisma.word.findMany({
      where: {
        organizationId,
        steps: { some: { activityId: activity.id } },
        targetLanguage: "es",
      },
    });

    expect(words).toHaveLength(2);
    expect(words.map((record) => record.word).toSorted()).toEqual(["gato", "hola"]);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.kind).toBe("vocabulary");
      expect(step.wordId).not.toBeNull();
      expect(step.isPublished).toBe(true);
    }
  });

  test("creates translation steps when translation activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab+Trans ${randomUUID()}`,
    });

    const [vocabActivity, transActivity] = await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "vocabulary",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Vocabulary ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "translation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Translation ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    const [vocabSteps, transSteps] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: vocabActivity.id },
      }),
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: transActivity.id },
      }),
    ]);

    expect(vocabSteps).toHaveLength(2);
    expect(transSteps).toHaveLength(2);

    for (const step of vocabSteps) {
      expect(step.kind).toBe("vocabulary");
      expect(step.wordId).not.toBeNull();
    }

    for (const step of transSteps) {
      expect(step.kind).toBe("translation");
      expect(step.wordId).not.toBeNull();
    }

    const [dbVocab, dbTrans] = await Promise.all([
      prisma.activity.findUnique({ where: { id: vocabActivity.id } }),
      prisma.activity.findUnique({ where: { id: transActivity.id } }),
    ]);

    expect(dbVocab?.generationStatus).toBe("completed");
    expect(dbTrans?.generationStatus).toBe("completed");
  });

  test("sets vocabulary status to 'completed' after full pipeline", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("sets vocabulary status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityVocabulary).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("returns vocabulary words for downstream workflows", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Return ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const result = await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    expect(result.words).toHaveLength(2);
    expect(result.words.map((record) => record.word).toSorted()).toEqual(["gato", "hola"]);
  });

  test("marks translation as 'failed' when vocabulary save fails", async () => {
    const upsertSpy = vi.spyOn(prisma.word, "upsert").mockRejectedValue(new Error("DB error"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Save Fail ${randomUUID()}`,
    });

    const [vocabActivity, transActivity] = await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "vocabulary",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Vocabulary ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "translation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Translation ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    const [dbVocab, dbTrans] = await Promise.all([
      prisma.activity.findUnique({ where: { id: vocabActivity.id } }),
      prisma.activity.findUnique({ where: { id: transActivity.id } }),
    ]);

    expect(dbVocab?.generationStatus).toBe("failed");
    expect(dbTrans?.generationStatus).toBe("failed");

    upsertSpy.mockRestore();
  });

  test("skips generation when activity is already completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const result = await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    expect(generateActivityVocabulary).not.toHaveBeenCalled();
    expect(result.words).toHaveLength(0);
  });

  test("preserves existing audioUrl when audio step fails but pronunciation and alternatives succeed", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `zkeep${id}`;
    const newWord = `znew${id}`;

    await prisma.word.create({
      data: {
        audioUrl: "https://example.com/keep-audio.mp3",
        organizationId,
        targetLanguage: "es",
        word: existingWord,
      },
    });

    const mockWords: VocabularyWord[] = [
      {
        translation: "existing",
        word: existingWord,
      },
      { translation: "new", word: newWord },
    ];

    vi.mocked(generateActivityVocabulary).mockResolvedValueOnce({
      data: { words: mockWords },
    } as Awaited<ReturnType<typeof generateActivityVocabulary>>);

    // Audio rejects for the new word → audio step throws → settled returns {}
    vi.mocked(generateLanguageAudio).mockRejectedValueOnce(new Error("TTS failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab KeepAudio ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    const updatedWord = await prisma.word.findFirst({
      where: { organizationId, targetLanguage: "es", word: existingWord },
    });

    expect(updatedWord?.audioUrl).toBe("https://example.com/keep-audio.mp3");
  });

  test("reuses existing Word record when casing differs", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `Hola${id}`;

    const existingRecord = await prisma.word.create({
      data: {
        audioUrl: "https://example.com/hola-audio.mp3",
        organizationId,
        targetLanguage: "es",
        word: existingWord,
      },
    });

    const mockWords: VocabularyWord[] = [
      {
        translation: "hello",
        word: existingWord.toLowerCase(),
      },
      { translation: "cat", word: `gato${id}` },
    ];

    vi.mocked(generateActivityVocabulary).mockResolvedValueOnce({
      data: { words: mockWords },
    } as Awaited<ReturnType<typeof generateActivityVocabulary>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab CaseDedup ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    const words = await prisma.word.findMany({
      where: {
        organizationId,
        targetLanguage: "es",
        word: { in: [existingWord, existingWord.toLowerCase()], mode: "insensitive" },
      },
    });

    // Should reuse the existing "Hola..." record, not create a new "hola..." one
    expect(words).toHaveLength(1);
    expect(words[0]!.word).toBe(existingWord);
    expect(words[0]!.id).toBe(existingRecord.id);
  });

  test("reuses existing audio when casing differs", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `Gato${id}`;

    await prisma.word.create({
      data: {
        audioUrl: "https://example.com/gato-audio.mp3",
        organizationId,
        targetLanguage: "es",
        word: existingWord,
      },
    });

    const mockWords: VocabularyWord[] = [
      {
        translation: "cat",
        word: existingWord.toLowerCase(),
      },
    ];

    vi.mocked(generateActivityVocabulary).mockResolvedValueOnce({
      data: { words: mockWords },
    } as Awaited<ReturnType<typeof generateActivityVocabulary>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab AudioCase ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    // Should not call TTS since audio for "Gato..." already exists on the Word record
    expect(generateLanguageAudio).not.toHaveBeenCalled();

    // The Word record should have the existing audioUrl preserved
    const word = await prisma.word.findFirst({
      where: { organizationId, targetLanguage: "es", word: existingWord },
    });

    expect(word?.audioUrl).toBe("https://example.com/gato-audio.mp3");
  });

  test("skips TTS for vocabulary words that already have an audioUrl", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `zexist${id}`;
    const newWord = `znew${id}`;

    await prisma.word.create({
      data: {
        audioUrl: "https://example.com/existing-audio.mp3",
        organizationId,
        targetLanguage: "es",
        word: existingWord,
      },
    });

    const mockWords: VocabularyWord[] = [
      {
        translation: "existing",
        word: existingWord,
      },
      { translation: "new", word: newWord },
    ];

    vi.mocked(generateActivityVocabulary).mockResolvedValueOnce({
      data: { words: mockWords },
    } as Awaited<ReturnType<typeof generateActivityVocabulary>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab SkipTTS ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    expect(generateLanguageAudio).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: existingWord }),
    );
    expect(generateLanguageAudio).toHaveBeenCalledWith(expect.objectContaining({ text: newWord }));
  });

  test("sets vocabulary status to 'failed' when pronunciation/alternatives DB write fails", async () => {
    const transactionSpy = vi.spyOn(prisma, "$transaction");

    // Let the first $transaction call through (saveWordAudioAndRomanizationStep),
    // but fail the pronunciation/alternatives persist. Since both run in
    // Promise.allSettled, we need to fail the specific call from
    // persistGeneratedFields. It's the first $transaction call because
    // the audio+romanization step runs in parallel and typically resolves
    // before the update step.
    transactionSpy.mockRejectedValueOnce(new Error("DB transaction failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab PersistFail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await vocabularyActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");

    transactionSpy.mockRestore();
  });
});
