import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateReadingAudioStep } from "./generate-reading-audio-step";

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
      Promise.resolve({ data: `/audio/${encodeURIComponent(text)}.mp3`, error: null }),
    ),
}));

describe(generateReadingAudioStep, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates audio for sentences that do not have existing audio", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Audio Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Audio ${randomUUID()}`,
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
      { explanation: null, sentence: `Guten Morgen ${id}`, translation: `Good morning ${id}` },
    ];

    const result = await generateReadingAudioStep(activities, sentences);

    expect(result.sentenceAudioUrls[`Guten Morgen ${id}`]).toBeDefined();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateAudio" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateAudio" }),
    );
  });

  test("reuses existing audio from Sentence records", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Audio Existing ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Audio Existing ${randomUUID()}`,
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
    const sentenceText = `Guten Tag ${id}`;

    await sentenceFixture({
      audioUrl: "/audio/existing-guten-tag.mp3",
      organizationId,
      sentence: sentenceText,
      targetLanguage: "de",
    });

    const activities = await fetchLessonActivities(lesson.id);

    const sentences = [{ explanation: null, sentence: sentenceText, translation: "Good day" }];

    const result = await generateReadingAudioStep(activities, sentences);

    expect(result.sentenceAudioUrls[sentenceText]).toBe("/audio/existing-guten-tag.mp3");
  });

  test("returns empty map when no reading activity exists", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Audio NoAct ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Audio NoAct ${randomUUID()}`,
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

    const result = await generateReadingAudioStep(activities, [
      { explanation: null, sentence: "test", translation: "test" },
    ]);

    expect(result).toEqual({ sentenceAudioUrls: {} });
  });

  test("returns empty map when sentences array is empty", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Audio Empty ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Audio Empty ${randomUUID()}`,
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
    const result = await generateReadingAudioStep(activities, []);

    expect(result).toEqual({ sentenceAudioUrls: {} });
  });

  test("skips sentences when TTS generation fails and returns partial results", async () => {
    const { generateLanguageAudio } = await import("@zoonk/core/audio/generate");

    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Audio Fail ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Audio Fail ${randomUUID()}`,
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
      { explanation: null, sentence: `Guten Morgen ${id}`, translation: `Good morning ${id}` },
      { explanation: null, sentence: `Gute Nacht ${id}`, translation: `Good night ${id}` },
    ];

    vi.mocked(generateLanguageAudio)
      .mockResolvedValueOnce({ data: `/audio/guten-morgen-${id}.mp3`, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("TTS failed") });

    const result = await generateReadingAudioStep(activities, sentences);

    expect(result.sentenceAudioUrls[`Guten Morgen ${id}`]).toBe(`/audio/guten-morgen-${id}.mp3`);
    expect(result.sentenceAudioUrls[`Gute Nacht ${id}`]).toBeUndefined();
  });

  test("returns empty map for unsupported TTS languages", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "xx" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Audio Unsupported ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Audio Unsupported ${randomUUID()}`,
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

    const result = await generateReadingAudioStep(activities, [
      { explanation: null, sentence: "test", translation: "test" },
    ]);

    expect(result).toEqual({ sentenceAudioUrls: {} });
  });
});
