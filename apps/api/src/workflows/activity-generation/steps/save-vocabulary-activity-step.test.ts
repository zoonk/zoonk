import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonActivity } from "./get-lesson-activities-step";
import { saveVocabularyActivityStep } from "./save-vocabulary-activity-step";

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

describe(saveVocabularyActivityStep, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    course = await courseFixture({ organizationId, targetLanguage: "pt" });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Vocabulary Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves canonical vocabulary, translation steps, and distractor word metadata", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const vocabularyWord = `boa noite ${id}`;
    const distractorWords = [`boa tarde ${id}`, `bom dia ${id}`] as const;

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Save Vocabulary ${randomUUID()}`,
    });

    const [vocabularyActivity, translationActivity] = await Promise.all([
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

    await saveVocabularyActivityStep({
      activities,
      distractors: {
        [vocabularyWord]: [...distractorWords, distractorWords[0]],
      },
      pronunciations: {
        [vocabularyWord]: `pron-${id}-boa-noite`,
        [distractorWords[0]]: `pron-${id}-boa-tarde`,
        [distractorWords[1]]: `pron-${id}-bom-dia`,
      },
      romanizations: {},
      wordAudioUrls: {
        [vocabularyWord]: `/audio/boa-noite-${id}.mp3`,
        [distractorWords[0]]: `/audio/boa-tarde-${id}.mp3`,
        [distractorWords[1]]: `/audio/bom-dia-${id}.mp3`,
      },
      words: [{ translation: "good evening", word: vocabularyWord }],
      workflowRunId: "workflow-1",
    });

    const [
      lessonWords,
      distractorLessonWords,
      words,
      pronunciations,
      vocabularySteps,
      translationSteps,
      dbVocabularyActivity,
      dbTranslationActivity,
    ] = await Promise.all([
      prisma.lessonWord.findMany({
        include: { word: true },
        where: { lessonId: lesson.id },
      }),
      prisma.lessonWord.findMany({
        where: {
          lessonId: lesson.id,
          word: {
            word: { in: [...distractorWords] },
          },
        },
      }),
      prisma.word.findMany({
        orderBy: { word: "asc" },
        where: {
          organizationId,
          targetLanguage: "pt",
          word: { in: [vocabularyWord, ...distractorWords] },
        },
      }),
      prisma.wordPronunciation.findMany({
        orderBy: { wordId: "asc" },
        where: {
          userLanguage: "en",
          word: {
            organizationId,
            targetLanguage: "pt",
            word: { in: [vocabularyWord, ...distractorWords] },
          },
        },
      }),
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: vocabularyActivity.id, kind: "vocabulary" },
      }),
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: translationActivity.id, kind: "translation" },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: vocabularyActivity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: translationActivity.id },
      }),
    ]);

    expect(lessonWords).toHaveLength(1);

    expect(lessonWords[0]).toMatchObject({
      distractors: [...distractorWords],
      translation: "good evening",
    });

    expect(lessonWords[0]?.word.word).toBe(vocabularyWord);
    expect(distractorLessonWords).toEqual([]);

    expect(words.map((entry) => [entry.word, entry.audioUrl])).toEqual([
      [vocabularyWord, `/audio/boa-noite-${id}.mp3`],
      [distractorWords[0], `/audio/boa-tarde-${id}.mp3`],
      [distractorWords[1], `/audio/bom-dia-${id}.mp3`],
    ]);

    expect(pronunciations).toHaveLength(3);
    expect(vocabularySteps).toHaveLength(1);
    expect(translationSteps).toHaveLength(1);
    expect(vocabularySteps[0]?.wordId).toBe(translationSteps[0]?.wordId ?? null);

    expect(dbVocabularyActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });

    expect(dbTranslationActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });
  });

  test("reuses existing word casing and preserves existing audio when casing differs", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `Boa Noite ${id}`;
    const lowercaseWord = existingWord.toLowerCase();

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Save Vocabulary Casing ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "vocabulary",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Vocabulary ${randomUUID()}`,
      }),
      wordFixture({
        audioUrl: "/audio/existing.mp3",
        organizationId,
        targetLanguage: "pt",
        word: existingWord,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    await saveVocabularyActivityStep({
      activities,
      distractors: { [lowercaseWord]: [] },
      pronunciations: { [lowercaseWord]: lowercaseWord },
      romanizations: {},
      wordAudioUrls: {},
      words: [{ translation: "good evening", word: lowercaseWord }],
      workflowRunId: "workflow-2",
    });

    const [words, lessonWord] = await Promise.all([
      prisma.word.findMany({
        where: {
          organizationId,
          targetLanguage: "pt",
          word: { in: [existingWord, lowercaseWord] },
        },
      }),
      prisma.lessonWord.findFirstOrThrow({
        include: { word: true },
        where: { lessonId: lesson.id },
      }),
    ]);

    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ audioUrl: "/audio/existing.mp3", word: existingWord });
    expect(lessonWord.word.word).toBe(existingWord);
  });
});
