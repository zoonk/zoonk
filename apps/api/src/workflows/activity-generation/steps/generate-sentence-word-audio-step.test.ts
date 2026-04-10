import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateSentenceWordAudioStep } from "./generate-sentence-word-audio-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi
    .fn()
    .mockImplementation(({ text }: { text: string }) =>
      Promise.resolve({ data: `/audio/${text}.mp3`, error: null }),
    ),
}));

describe(generateSentenceWordAudioStep, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates audio for words that do not have existing audio", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Audio Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Audio ${randomUUID()}`,
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

    const result = await generateSentenceWordAudioStep(activities, words);

    expect(result.wordAudioUrls[`guten-${id}`]).toBe(`/audio/guten-${id}.mp3`);
    expect(result.wordAudioUrls[`morgen-${id}`]).toBe(`/audio/morgen-${id}.mp3`);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateSentenceWordAudio" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateSentenceWordAudio" }),
    );
  });

  test("reuses existing audio from Word records", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Audio Existing ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Audio Existing ${randomUUID()}`,
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

    await wordFixture({
      audioUrl: "/audio/existing-hallo.mp3",
      organizationId,
      targetLanguage: "de",
      word: existingWordText,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generateSentenceWordAudioStep(activities, [existingWordText]);

    expect(result.wordAudioUrls[existingWordText]).toBe("/audio/existing-hallo.mp3");
  });

  test("returns empty map when no reading activity exists", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Audio NoAct ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Audio NoAct ${randomUUID()}`,
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
    const result = await generateSentenceWordAudioStep(activities, ["hallo"]);

    expect(result).toEqual({ wordAudioUrls: {} });
  });

  test("returns empty map when words array is empty", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Audio Empty ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Audio Empty ${randomUUID()}`,
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
    const result = await generateSentenceWordAudioStep(activities, []);

    expect(result).toEqual({ wordAudioUrls: {} });
  });

  test("skips words when TTS generation fails and returns partial results", async () => {
    const { generateLanguageAudio } = await import("@zoonk/core/audio/generate");

    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Audio Fail ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Audio Fail ${randomUUID()}`,
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

    vi.mocked(generateLanguageAudio)
      .mockResolvedValueOnce({ data: `/audio/guten-${id}.mp3`, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("TTS failed") });

    const result = await generateSentenceWordAudioStep(activities, words);

    expect(result.wordAudioUrls[`guten-${id}`]).toBe(`/audio/guten-${id}.mp3`);
    expect(result.wordAudioUrls[`morgen-${id}`]).toBeUndefined();
  });

  test("returns empty map for unsupported TTS languages", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "xx" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `SentWord Audio Unsupported ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `SentWord Audio Unsupported ${randomUUID()}`,
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
    const result = await generateSentenceWordAudioStep(activities, ["test"]);

    expect(result).toEqual({ wordAudioUrls: {} });
  });
});
