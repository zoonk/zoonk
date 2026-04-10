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
import { generateSentenceDistractorsStep } from "./generate-sentence-distractors-step";

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
  generateActivityDistractors: vi.fn().mockImplementation(({ input }: { input: string }) =>
    Promise.resolve({
      data: { distractors: [`dist1-${input.slice(0, 5)}`, `dist2-${input.slice(0, 5)}`] },
    }),
  ),
}));

describe(generateSentenceDistractorsStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Sentence Distractors Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates distractors for both sentences and translations", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Sentence Distractors ${randomUUID()}`,
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
        sentence: `Guten Morgen ${id}`,
        translation: `Good morning ${id}`,
      },
    ];

    const result = await generateSentenceDistractorsStep(activities, sentences);

    expect(Object.keys(result.distractors)).toHaveLength(1);
    expect(result.distractors[`Guten Morgen ${id}`]).toBeDefined();

    expect(Object.keys(result.translationDistractors)).toHaveLength(1);
    expect(result.translationDistractors[`Good morning ${id}`]).toBeDefined();

    // Two calls per sentence: one for target language, one for user language
    expect(generateActivityDistractors).toHaveBeenCalledTimes(2);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateSentenceDistractors" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateSentenceDistractors" }),
    );
  });

  test("returns empty maps when no reading activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Sentence Distractors NoAct ${randomUUID()}`,
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

    const result = await generateSentenceDistractorsStep(activities, [
      { explanation: "test explanation", sentence: "test", translation: "test" },
    ]);

    expect(result).toEqual({ distractors: {}, translationDistractors: {} });
    expect(generateActivityDistractors).not.toHaveBeenCalled();
  });

  test("returns empty distractors for a sentence when AI fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Sentence Distractors Fail ${randomUUID()}`,
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
        sentence: `Guten Morgen ${id}`,
        translation: `Good morning ${id}`,
      },
    ];

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test mock doesn't need full AI SDK return shape
    (vi.mocked(generateActivityDistractors) as any)
      .mockResolvedValueOnce({
        data: { distractors: [`dist1-Guten`, `dist2-Guten`] },
      })
      .mockRejectedValueOnce(new Error("AI failed"));

    const result = await generateSentenceDistractorsStep(activities, sentences);

    expect(result.distractors[`Guten Morgen ${id}`]).toEqual([`dist1-Guten`, `dist2-Guten`]);
    expect(result.translationDistractors[`Good morning ${id}`]).toEqual([]);
  });

  test("returns empty maps when sentences array is empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Sentence Distractors Empty ${randomUUID()}`,
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
    const result = await generateSentenceDistractorsStep(activities, []);

    expect(result).toEqual({ distractors: {}, translationDistractors: {} });
    expect(generateActivityDistractors).not.toHaveBeenCalled();
  });
});
