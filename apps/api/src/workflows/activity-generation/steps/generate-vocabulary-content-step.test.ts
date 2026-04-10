import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { generateActivityVocabulary } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateVocabularyContentStep } from "./generate-vocabulary-content-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/vocabulary", () => ({
  generateActivityVocabulary: vi.fn().mockResolvedValue({
    data: {
      words: [
        { translation: "hello", word: "hola" },
        { translation: "goodbye", word: "adiós" },
      ],
    },
  }),
}));

const validWords = [
  { translation: "hello", word: "hola" },
  { translation: "goodbye", word: "adiós" },
];

describe(generateVocabularyContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId, targetLanguage: "es" });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Content Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns generated vocabulary words on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Content ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const [activity] = await fetchLessonActivities(lesson.id);
    const result = await generateVocabularyContentStep(activity!, "workflow-1", ["greetings"]);

    expect(result).toEqual({ words: validWords });

    expect(generateActivityVocabulary).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterTitle: chapter.title,
        concepts: ["greetings"],
        targetLanguage: "es",
        userLanguage: "en",
      }),
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateVocabularyContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateVocabularyContent" }),
    );
  });

  test("marks activity as failed and streams error when AI fails", async () => {
    vi.mocked(generateActivityVocabulary).mockRejectedValueOnce(new Error("AI error"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Content Fail ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const [activity] = await fetchLessonActivities(lesson.id);
    const result = await generateVocabularyContentStep(activity!, "workflow-2");

    expect(result).toEqual({ words: [] });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateVocabularyContent" }),
    );
  });

  test("marks activity as failed and streams error when AI returns empty words array", async () => {
    vi.mocked(generateActivityVocabulary).mockResolvedValueOnce({
      data: { words: [] },
    } as never);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Content Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const [activity] = await fetchLessonActivities(lesson.id);
    const result = await generateVocabularyContentStep(activity!, "workflow-3");

    expect(result).toEqual({ words: [] });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        reason: "contentValidationFailed",
        status: "error",
        step: "generateVocabularyContent",
      }),
    );
  });
});
