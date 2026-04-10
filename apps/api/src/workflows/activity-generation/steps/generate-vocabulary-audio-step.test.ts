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
import { generateVocabularyAudioStep } from "./generate-vocabulary-audio-step";

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

describe(generateVocabularyAudioStep, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates audio for words that do not have existing audio", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "es" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Audio Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Audio ${randomUUID()}`,
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
    const words = [`hola-${id}`, `adiós-${id}`];

    const result = await generateVocabularyAudioStep(activities, words);

    expect(result.wordAudioUrls[`hola-${id}`]).toBe(`/audio/hola-${id}.mp3`);
    expect(result.wordAudioUrls[`adiós-${id}`]).toBe(`/audio/adiós-${id}.mp3`);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateVocabularyAudio" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateVocabularyAudio" }),
    );
  });

  test("reuses existing audio from Word records", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "es" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Audio Existing ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Audio Existing ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocabulary ${randomUUID()}`,
    });

    const id = randomUUID().slice(0, 8);
    const existingWordText = `hola-${id}`;

    await wordFixture({
      audioUrl: "/audio/existing-hola.mp3",
      organizationId,
      targetLanguage: "es",
      word: existingWordText,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generateVocabularyAudioStep(activities, [existingWordText]);

    expect(result.wordAudioUrls[existingWordText]).toBe("/audio/existing-hola.mp3");
  });

  test("returns empty map when no vocabulary activity exists", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "es" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Audio NoAct ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Audio NoAct ${randomUUID()}`,
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
    const result = await generateVocabularyAudioStep(activities, ["hola"]);

    expect(result).toEqual({ wordAudioUrls: {} });
  });

  test("returns empty map when words array is empty", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "es" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Audio Empty ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Audio Empty ${randomUUID()}`,
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
    const result = await generateVocabularyAudioStep(activities, []);

    expect(result).toEqual({ wordAudioUrls: {} });
  });

  test("skips words when TTS generation fails and returns partial results", async () => {
    const { generateLanguageAudio } = await import("@zoonk/core/audio/generate");

    const course = await courseFixture({ organizationId, targetLanguage: "es" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Audio Fail ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Audio Fail ${randomUUID()}`,
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
    const words = [`bueno-${id}`, `malo-${id}`];

    vi.mocked(generateLanguageAudio)
      .mockResolvedValueOnce({ data: `/audio/bueno-${id}.mp3`, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("TTS failed") });

    const result = await generateVocabularyAudioStep(activities, words);

    expect(result.wordAudioUrls[`bueno-${id}`]).toBe(`/audio/bueno-${id}.mp3`);
    expect(result.wordAudioUrls[`malo-${id}`]).toBeUndefined();
  });

  test("returns empty map for unsupported TTS languages", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "xx" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Audio Unsupported ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Audio Unsupported ${randomUUID()}`,
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
    const result = await generateVocabularyAudioStep(activities, ["test"]);

    expect(result).toEqual({ wordAudioUrls: {} });
  });
});
