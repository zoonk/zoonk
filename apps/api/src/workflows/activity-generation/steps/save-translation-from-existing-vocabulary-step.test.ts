import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveTranslationFromExistingVocabularyStep } from "./save-translation-from-existing-vocabulary-step";

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

describe(saveTranslationFromExistingVocabularyStep, () => {
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
      title: `Save Translation Existing Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates translation steps from completed vocabulary steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Translation Existing ${randomUUID()}`,
    });

    const [vocabularyActivity, translationActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
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

    const [firstWord, secondWord] = await Promise.all([
      wordFixture({ organizationId, targetLanguage: "pt", word: `word-a-${randomUUID()}` }),
      wordFixture({ organizationId, targetLanguage: "pt", word: `word-b-${randomUUID()}` }),
    ]);

    await Promise.all([
      stepFixture({
        activityId: vocabularyActivity.id,
        content: {},
        kind: "vocabulary",
        position: 0,
        wordId: firstWord.id,
      }),
      stepFixture({
        activityId: vocabularyActivity.id,
        content: {},
        kind: "vocabulary",
        position: 1,
        wordId: secondWord.id,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    await saveTranslationFromExistingVocabularyStep({
      allActivities: activities,
      workflowRunId: "workflow-1",
    });

    const [translationSteps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: translationActivity.id, kind: "translation" },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: translationActivity.id },
      }),
    ]);

    expect(translationSteps).toHaveLength(2);
    expect(translationSteps.map((step) => [step.position, step.wordId])).toEqual([
      [0, firstWord.id],
      [1, secondWord.id],
    ]);
    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });
  });

  test("marks translation as failed when vocabulary steps do not exist", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Translation Missing ${randomUUID()}`,
    });

    const [, translationActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
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

    await saveTranslationFromExistingVocabularyStep({
      allActivities: activities,
      workflowRunId: "workflow-2",
    });

    const dbActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: translationActivity.id },
    });

    expect(dbActivity.generationStatus).toBe("failed");
  });
});
