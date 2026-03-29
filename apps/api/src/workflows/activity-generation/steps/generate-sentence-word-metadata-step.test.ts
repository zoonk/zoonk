import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { generateTranslation } from "@zoonk/ai/tasks/activities/language/translation";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateSentenceWordMetadataStep } from "./generate-sentence-word-metadata-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/translation", () => ({
  generateTranslation: vi
    .fn()
    .mockImplementation(({ word }: { word: string }) =>
      Promise.resolve({ data: { translation: `translated-${word}` } }),
    ),
}));

vi.mock("@zoonk/ai/tasks/activities/language/romanization", () => ({
  generateActivityRomanization: vi.fn().mockImplementation(({ texts }: { texts: string[] }) =>
    Promise.resolve({
      data: { romanizations: texts.map((text) => `roman-${text}`) },
    }),
  ),
}));

describe(generateSentenceWordMetadataStep, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns word metadata with translations for Roman script languages", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Meta Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Meta ${randomUUID()}`,
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
      { explanation: null, sentence: `Guten${id} Morgen${id}`, translation: "Good morning" },
    ];

    const targetWords = [`guten${id}`, `morgen${id}`];

    const result = await generateSentenceWordMetadataStep(activities, sentences, targetWords);

    expect(result.wordMetadata[`guten${id}`]).toBeDefined();
    expect(result.wordMetadata[`guten${id}`]?.translation).toBeDefined();
    expect(result.wordMetadata[`guten${id}`]?.romanization).toBeNull();

    expect(generateTranslation).toHaveBeenCalled();
    expect(generateActivityRomanization).not.toHaveBeenCalled();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateSentenceWordMetadata" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateSentenceWordMetadata" }),
    );
  });

  test("returns word metadata with romanizations for non-Roman script languages", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Meta JA ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Meta JA ${randomUUID()}`,
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

    const sentences = [{ explanation: null, sentence: `猫${id} 犬${id}`, translation: "Cat dog" }];

    const targetWords = [`猫${id}`, `犬${id}`];

    const result = await generateSentenceWordMetadataStep(activities, sentences, targetWords);

    expect(result.wordMetadata[`猫${id}`]).toBeDefined();
    expect(result.wordMetadata[`猫${id}`]?.romanization).toBeDefined();

    expect(generateTranslation).toHaveBeenCalled();
    expect(generateActivityRomanization).toHaveBeenCalled();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateSentenceWordMetadata" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateSentenceWordMetadata" }),
    );
  });

  test("returns empty metadata when no reading activity exists", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Meta NoAct ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Meta NoAct ${randomUUID()}`,
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

    const result = await generateSentenceWordMetadataStep(
      activities,
      [{ explanation: null, sentence: "Hallo", translation: "Hello" }],
      ["hallo"],
    );

    expect(result).toEqual({ wordMetadata: {} });
    expect(generateTranslation).not.toHaveBeenCalled();
  });

  test("returns empty metadata when sentences array is empty", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Meta Empty ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Meta Empty ${randomUUID()}`,
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
    const result = await generateSentenceWordMetadataStep(activities, [], []);

    expect(result).toEqual({ wordMetadata: {} });
    expect(generateTranslation).not.toHaveBeenCalled();
  });

  test("streams error when translations are incomplete", async () => {
    vi.mocked(generateTranslation).mockRejectedValue(new Error("AI error"));

    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Meta Fail ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Meta Fail ${randomUUID()}`,
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
      { explanation: null, sentence: `Hallo${id} Welt${id}`, translation: "Hello World" },
    ];

    const result = await generateSentenceWordMetadataStep(activities, sentences, [
      `hallo${id}`,
      `welt${id}`,
    ]);

    expect(result.wordMetadata).toBeDefined();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        status: "error",
        step: "generateSentenceWordMetadata",
      }),
    );
  });
});
