import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { generateActivityDistractors } from "@zoonk/ai/tasks/activities/language/distractors";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateVocabularyDistractorsStep } from "./generate-vocabulary-distractors-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/distractors", () => ({
  generateActivityDistractors: vi
    .fn()
    .mockImplementation(({ input }: { input: string }) =>
      Promise.resolve({ data: { distractors: [`not-${input}`, `fake-${input}`] } }),
    ),
}));

describe(generateVocabularyDistractorsStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId, targetLanguage: "es" });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Vocab Distractors Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates distractors for each vocabulary word", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Distractors ${randomUUID()}`,
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
    const words = [
      { translation: "hello", word: `hola-${id}` },
      { translation: "goodbye", word: `adiós-${id}` },
    ];

    const result = await generateVocabularyDistractorsStep(activities, words);

    expect(Object.keys(result.distractors)).toHaveLength(2);
    expect(result.distractors[`hola-${id}`]).toBeDefined();
    expect(result.distractors[`adiós-${id}`]).toBeDefined();

    expect(generateActivityDistractors).toHaveBeenCalledTimes(2);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateVocabularyDistractors" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateVocabularyDistractors" }),
    );
  });

  test("returns empty distractors when no vocabulary activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Distractors NoAct ${randomUUID()}`,
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

    const result = await generateVocabularyDistractorsStep(activities, [
      { translation: "hello", word: "hola" },
    ]);

    expect(result).toEqual({ distractors: {} });
    expect(generateActivityDistractors).not.toHaveBeenCalled();
  });

  test("returns empty distractors for a word when AI fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Distractors Fail ${randomUUID()}`,
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
    const words = [
      { translation: "hello", word: `hola-${id}` },
      { translation: "goodbye", word: `adiós-${id}` },
    ];

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test mock doesn't need full AI SDK return shape
    (vi.mocked(generateActivityDistractors) as any)
      .mockResolvedValueOnce({
        data: { distractors: [`not-hola-${id}`, `fake-hola-${id}`] },
      })
      .mockRejectedValueOnce(new Error("AI failed"));

    const result = await generateVocabularyDistractorsStep(activities, words);

    expect(result.distractors[`hola-${id}`]).toEqual([`not-hola-${id}`, `fake-hola-${id}`]);
    expect(result.distractors[`adiós-${id}`]).toEqual([]);
  });

  test("returns empty distractors when words array is empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Vocab Distractors Empty ${randomUUID()}`,
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
    const result = await generateVocabularyDistractorsStep(activities, []);

    expect(result).toEqual({ distractors: {} });
    expect(generateActivityDistractors).not.toHaveBeenCalled();
  });
});
