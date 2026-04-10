import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateVocabularyRomanizationStep } from "./generate-vocabulary-romanization-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/romanization", () => ({
  generateActivityRomanization: vi.fn().mockImplementation(({ texts }: { texts: string[] }) =>
    Promise.resolve({
      data: { romanizations: texts.map((text) => `roman-${text}`) },
    }),
  ),
}));

describe(generateVocabularyRomanizationStep, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns romanizations for non-Roman script languages", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Roman Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Roman ${randomUUID()}`,
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
    const id = randomUUID().slice(0, 8);
    const words = [`猫-${id}`, `犬-${id}`];

    const result = await generateVocabularyRomanizationStep(activities, words);

    expect(result.romanizations[`猫-${id}`]).toBe(`roman-猫-${id}`);
    expect(result.romanizations[`犬-${id}`]).toBe(`roman-犬-${id}`);

    expect(generateActivityRomanization).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", texts: words }),
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateVocabularyRomanization" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateVocabularyRomanization" }),
    );
  });

  test("returns empty romanizations for Roman script languages without calling AI", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "es" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Roman Skip ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Roman Skip ${randomUUID()}`,
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
    const result = await generateVocabularyRomanizationStep(activities, ["hola"]);

    expect(result).toEqual({ romanizations: {} });
    expect(generateActivityRomanization).not.toHaveBeenCalled();
  });

  test("returns empty romanizations when no vocabulary activity exists", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Roman NoAct ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Roman NoAct ${randomUUID()}`,
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
    const result = await generateVocabularyRomanizationStep(activities, ["猫"]);

    expect(result).toEqual({ romanizations: {} });
    expect(generateActivityRomanization).not.toHaveBeenCalled();
  });

  test("marks activity as failed and streams error when AI romanization fails", async () => {
    vi.mocked(generateActivityRomanization).mockRejectedValueOnce(new Error("AI error"));

    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Roman Fail ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Roman Fail ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const result = await generateVocabularyRomanizationStep(activities, ["猫"]);

    expect(result).toEqual({ romanizations: {} });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateVocabularyRomanization" }),
    );
  });

  test("marks activity as failed and streams error when some romanizations are missing", async () => {
    vi.mocked(generateActivityRomanization).mockResolvedValueOnce({
      data: { romanizations: ["neko"] },
    } as never);

    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Roman Partial ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Roman Partial ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const result = await generateVocabularyRomanizationStep(activities, ["猫", "犬"]);

    expect(result.romanizations["猫"]).toBe("neko");

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateVocabularyRomanization" }),
    );
  });
});
