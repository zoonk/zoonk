import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture, wordPronunciationFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateSentenceWordPronunciationStep } from "./generate-sentence-word-pronunciation-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/pronunciation", () => ({
  generateActivityPronunciation: vi
    .fn()
    .mockImplementation(({ word }: { word: string }) =>
      Promise.resolve({ data: { pronunciation: `pron-${word}` } }),
    ),
}));

describe(generateSentenceWordPronunciationStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates missing pronunciations for sentence words", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Pron Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Pron ${randomUUID()}`,
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
    const words = [`guten-${id}`, `morgen-${id}`];

    const result = await generateSentenceWordPronunciationStep(activities, words);

    expect(result.pronunciations[`guten-${id}`]).toBe(`pron-guten-${id}`);
    expect(result.pronunciations[`morgen-${id}`]).toBe(`pron-morgen-${id}`);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateSentenceWordPronunciation" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateSentenceWordPronunciation" }),
    );
  });

  test("reuses existing pronunciations from Word records", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Pron Existing ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Pron Existing ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const id = randomUUID().slice(0, 8);
    const existingWordText = `hallo-${id}`;

    const word = await wordFixture({
      organizationId,
      targetLanguage: "de",
      word: existingWordText,
    });

    await wordPronunciationFixture({
      pronunciation: "existing-pron",
      userLanguage: "en",
      wordId: word.id,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generateSentenceWordPronunciationStep(activities, [existingWordText]);

    expect(result.pronunciations[existingWordText]).toBe("existing-pron");
    expect(generateActivityPronunciation).not.toHaveBeenCalled();
  });

  test("returns empty pronunciations when no reading activity exists", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Pron NoAct ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Pron NoAct ${randomUUID()}`,
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
    const result = await generateSentenceWordPronunciationStep(activities, ["hallo"]);

    expect(result).toEqual({ pronunciations: {} });
  });

  test("returns empty pronunciations when words array is empty", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Pron Empty ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Pron Empty ${randomUUID()}`,
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
    const result = await generateSentenceWordPronunciationStep(activities, []);

    expect(result).toEqual({ pronunciations: {} });
  });

  test("throws when pronunciation AI fails", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Pron Fail ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Pron Fail ${randomUUID()}`,
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
    const words = [`guten-${id}`, `morgen-${id}`];

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test mock doesn't need full AI SDK return shape
    (vi.mocked(generateActivityPronunciation) as any)
      .mockResolvedValueOnce({
        data: { pronunciation: `pron-guten-${id}` },
      })
      .mockRejectedValueOnce(new Error("AI failed"));

    await expect(generateSentenceWordPronunciationStep(activities, words)).rejects.toThrow(
      "AI failed",
    );
  });

  test("returns empty pronunciations when course has no organization", async () => {
    const course = await courseFixture({
      organizationId: null as never,
      targetLanguage: "de",
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Pron NoOrg ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Pron NoOrg ${randomUUID()}`,
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
    const result = await generateSentenceWordPronunciationStep(activities, ["hallo"]);

    expect(result).toEqual({ pronunciations: {} });
  });
});
