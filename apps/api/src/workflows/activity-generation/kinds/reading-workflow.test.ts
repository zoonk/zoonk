import { randomUUID } from "node:crypto";
import { generateSentenceWordTranslation } from "@zoonk/ai/tasks/activities/language/sentence-word-translation";
import { generateActivitySentences } from "@zoonk/ai/tasks/activities/language/sentences";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { readingActivityWorkflow } from "./reading-workflow";

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
          sentence: "Hola, como estas?",
          translation: "Hello, how are you?",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/sentence-word-translation", () => ({
  generateSentenceWordTranslation: vi.fn().mockResolvedValue({
    data: { romanization: null, translation: "mocked" },
  }),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi.fn().mockResolvedValue({
    data: "https://example.com/audio.mp3",
    error: null,
  }),
}));

const words = [
  { alternativeTranslations: [], romanization: "ga-to", translation: "cat", word: "gato" },
  { alternativeTranslations: [], romanization: "o-la", translation: "hello", word: "hola" },
];

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

describe(readingActivityWorkflow, () => {
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
      title: `Reading Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates reading sentences and steps in database", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    const sentences = await prisma.sentence.findMany({
      where: {
        organizationId,
        steps: { some: { activityId: activity.id } },
        targetLanguage: "es",
        userLanguage: "en",
      },
    });

    expect(sentences).toHaveLength(2);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.kind).toBe("reading");
      expect(step.sentenceId).not.toBeNull();
      expect(step.isPublished).toBeTruthy();
    }
  });

  test("sets reading status to 'completed' after full pipeline", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("creates Word records for sentence words without creating LessonWord entries", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Words ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    // Sentence words should be saved as Word records
    const savedWords = await prisma.word.findMany({
      where: {
        organizationId,
        targetLanguage: "es",
        userLanguage: "en",
        word: { in: ["yo", "veo", "un", "gato", "hola", "como", "estas"] },
      },
    });

    expect(savedWords).toHaveLength(7);

    // Sentence words should NOT be linked as LessonWord entries
    const lessonWords = await prisma.lessonWord.findMany({
      where: { lessonId: lesson.id },
    });

    expect(lessonWords).toHaveLength(0);
  });

  test("sets reading status to 'failed' when no source words available", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading NoWords ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", [], [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivitySentences).not.toHaveBeenCalled();
  });

  test("skips generation when activity is already completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    expect(generateActivitySentences).not.toHaveBeenCalled();
  });

  test("does not save words with empty translation when metadata generation partially fails", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const failWord = `zfail${id}`;
    const passWord = `zpass${id}`;

    vi.mocked(generateActivitySentences).mockResolvedValueOnce({
      data: {
        sentences: [
          {
            romanization: "r1",
            sentence: `${passWord} ${failWord}`,
            translation: "pass fail",
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateActivitySentences>>);

    vi.mocked(generateSentenceWordTranslation).mockImplementation(async ({ word }) => {
      if (word === failWord) {
        throw new Error("AI translation failure");
      }

      return {
        data: { romanization: null, translation: `translated-${word}` },
      } as Awaited<ReturnType<typeof generateSentenceWordTranslation>>;
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading PartialFail ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    const failWordInDb = await prisma.word.findMany({
      where: {
        organizationId,
        targetLanguage: "es",
        userLanguage: "en",
        word: failWord,
      },
    });

    const emptyTranslationWords = failWordInDb.filter((word) => word.translation === "");
    expect(emptyTranslationWords).toHaveLength(0);
  });

  test("reuses existing Word metadata with different casing (case-insensitive lookup)", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const capitalizedWord = `Zcap${id}`;
    const lowercaseWord = capitalizedWord.toLowerCase();

    await prisma.word.create({
      data: {
        organizationId,
        romanization: "existing-rom",
        targetLanguage: "es",
        translation: "existing-translation",
        userLanguage: "en",
        word: capitalizedWord,
      },
    });

    vi.mocked(generateActivitySentences).mockResolvedValueOnce({
      data: {
        sentences: [
          {
            romanization: "r1",
            sentence: `${capitalizedWord} test`,
            translation: "cap test",
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateActivitySentences>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading CaseInsensitive ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    // Should NOT call AI for the word since it already exists (just with different casing)
    expect(generateSentenceWordTranslation).not.toHaveBeenCalledWith(
      expect.objectContaining({ word: lowercaseWord }),
    );

    // Should not create a duplicate lowercase Word record
    const allVariants = await prisma.word.findMany({
      where: {
        organizationId,
        targetLanguage: "es",
        userLanguage: "en",
        word: { in: [capitalizedWord, lowercaseWord] },
      },
    });

    expect(allVariants).toHaveLength(1);
    expect(allVariants[0]!.word).toBe(capitalizedWord);
  });

  test("skips TTS for sentence words that already have a WordAudio record", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `zexist${id}`;
    const newWord = `znew${id}`;

    const wordAudio = await prisma.wordAudio.create({
      data: {
        audioUrl: "https://example.com/existing-audio.mp3",
        organizationId,
        targetLanguage: "es",
        word: existingWord,
      },
    });

    await prisma.word.create({
      data: {
        organizationId,
        targetLanguage: "es",
        translation: "existing",
        userLanguage: "en",
        word: existingWord,
        wordAudioId: wordAudio.id,
      },
    });

    vi.mocked(generateActivitySentences).mockResolvedValueOnce({
      data: {
        sentences: [
          {
            romanization: "r1",
            sentence: `${existingWord} ${newWord}`,
            translation: "existing new",
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateActivitySentences>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading SkipTTS ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    expect(generateLanguageAudio).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: existingWord }),
    );
    expect(generateLanguageAudio).toHaveBeenCalledWith(expect.objectContaining({ text: newWord }));
  });
});
