import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { generateActivitySentences } from "@zoonk/ai/tasks/activities/language/sentences";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateReadingContentStep } from "./generate-reading-content-step";

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
          explanation: "test explanation",
          sentence: "Guten Morgen",
          translation: "Good morning",
        },
      ],
    },
  }),
}));

describe(generateReadingContentStep, () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    course = await courseFixture({ organizationId, targetLanguage: "de" });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Content Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("falls back to existing lesson words when the current run has none", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Fallback ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const word = await wordFixture({
      organizationId,
      targetLanguage: "de",
      word: `hallo-${randomUUID().slice(0, 8)}`,
    });

    await lessonWordFixture({
      lessonId: lesson.id,
      translation: "hello",
      userLanguage: "en",
      wordId: word.id,
    });

    const [activity] = await fetchLessonActivities(lesson.id);

    const result = await generateReadingContentStep(activity!, "workflow-1", []);

    expect(result.sentences).toEqual([
      {
        explanation: "test explanation",
        sentence: "Guten Morgen",
        translation: "Good morning",
      },
    ]);
    expect(generateActivitySentences).toHaveBeenCalledWith({
      chapterTitle: chapter.title,
      concepts: [],
      lessonDescription: lesson.description ?? undefined,
      lessonTitle: lesson.title,
      neighboringConcepts: [],
      targetLanguage: "de",
      userLanguage: "en",
      words: [word.word],
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: readingActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("pending");
  });

  test("marks the activity as failed when no source words are available", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading No Source ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const [activity] = await fetchLessonActivities(lesson.id);

    const result = await generateReadingContentStep(activity!, "workflow-2", []);

    expect(result).toEqual({ sentences: [] });
    expect(generateActivitySentences).not.toHaveBeenCalled();

    const dbActivity = await prisma.activity.findUnique({
      where: { id: readingActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
  });
});
