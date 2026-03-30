import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateReadingRomanizationStep } from "./generate-reading-romanization-step";

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

describe(generateReadingRomanizationStep, () => {
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
      title: `Reading Roman Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Roman ${randomUUID()}`,
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
    const id = randomUUID().slice(0, 8);

    const sentences = [
      {
        explanation: "test explanation",
        sentence: `これは猫です-${id}`,
        translation: `This is a cat ${id}`,
      },
    ];

    const result = await generateReadingRomanizationStep(activities, sentences);

    expect(result.romanizations[`これは猫です-${id}`]).toBe(`roman-これは猫です-${id}`);

    expect(generateActivityRomanization).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "ja",
        texts: [`これは猫です-${id}`],
      }),
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateReadingRomanization" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateReadingRomanization" }),
    );
  });

  test("returns empty romanizations for Roman script languages without calling AI", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Roman Skip ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Roman Skip ${randomUUID()}`,
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

    const result = await generateReadingRomanizationStep(activities, [
      { explanation: "test explanation", sentence: "Guten Morgen", translation: "Good morning" },
    ]);

    expect(result).toEqual({ romanizations: {} });
    expect(generateActivityRomanization).not.toHaveBeenCalled();
  });

  test("returns empty romanizations when no reading activity exists", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Roman NoAct ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Roman NoAct ${randomUUID()}`,
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

    const result = await generateReadingRomanizationStep(activities, [
      { explanation: "test explanation", sentence: "これは猫です", translation: "This is a cat" },
    ]);

    expect(result).toEqual({ romanizations: {} });
    expect(generateActivityRomanization).not.toHaveBeenCalled();
  });

  test("streams error when AI romanization fails", async () => {
    vi.mocked(generateActivityRomanization).mockRejectedValueOnce(new Error("AI error"));

    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Roman Fail ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Roman Fail ${randomUUID()}`,
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

    const result = await generateReadingRomanizationStep(activities, [
      { explanation: "test explanation", sentence: "これは猫です", translation: "This is a cat" },
    ]);

    expect(result).toEqual({ romanizations: {} });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateReadingRomanization" }),
    );
  });

  test("streams error when some romanizations are missing", async () => {
    vi.mocked(generateActivityRomanization).mockResolvedValueOnce({
      data: { romanizations: ["kore wa neko desu"] },
    } as never);

    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Roman Partial ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Roman Partial ${randomUUID()}`,
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

    const sentences = [
      { explanation: "test explanation", sentence: "これは猫です", translation: "This is a cat" },
      { explanation: "test explanation", sentence: "あれは犬です", translation: "That is a dog" },
    ];

    const result = await generateReadingRomanizationStep(activities, sentences);

    expect(result.romanizations["これは猫です"]).toBe("kore wa neko desu");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateReadingRomanization" }),
    );
  });
});
