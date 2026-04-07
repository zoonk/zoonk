import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomVisualContentStep } from "./generate-custom-visual-content-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

const { dispatchVisualContentMock } = vi.hoisted(() => ({
  dispatchVisualContentMock: vi.fn(),
}));

vi.mock("@zoonk/core/steps/dispatch-visual-content", () => ({
  dispatchVisualContent: dispatchVisualContentMock,
}));

describe(generateCustomVisualContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Custom Content Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns visual content rows for each custom activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Content ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const descriptionResults = [
      {
        activityId: activity.id,
        descriptions: [{ description: "A code snippet", kind: "code" as const }],
      },
    ];

    dispatchVisualContentMock.mockResolvedValue([
      { annotations: null, code: "const x = 1;", kind: "code", language: "typescript" },
    ]);

    const results = await generateCustomVisualContentStep(activities, descriptionResults);

    expect(results).toHaveLength(1);
    expect(results[0]?.activityId).toBe(activity.id);
    expect(results[0]?.completedRows).toHaveLength(1);
    expect(results[0]?.completedRows[0]).toMatchObject({
      activityId: activity.id,
      kind: "visual",
      position: 1,
    });
  });

  test("returns empty array when description results are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Content Empty ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const results = await generateCustomVisualContentStep(activities, []);

    expect(results).toEqual([]);
  });

  test("returns empty rows for an activity with empty descriptions", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Content No Desc ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const descriptionResults = [{ activityId: activity.id, descriptions: [] }];

    const results = await generateCustomVisualContentStep(activities, descriptionResults);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      activityId: activity.id,
      completedRows: [],
    });
    expect(dispatchVisualContentMock).not.toHaveBeenCalled();
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Content Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    dispatchVisualContentMock.mockResolvedValue([
      { annotations: null, code: "x", kind: "code", language: "js" },
    ]);

    await generateCustomVisualContentStep(activities, [
      {
        activityId: activity.id,
        descriptions: [{ description: "A code snippet", kind: "code" as const }],
      },
    ]);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateVisualContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateVisualContent" }),
    );
  });

  test("streams error status when some dispatches fail", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Content Error ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Custom OK ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Custom Fail ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    dispatchVisualContentMock
      .mockResolvedValueOnce([{ annotations: null, code: "x", kind: "code", language: "js" }])
      .mockRejectedValueOnce(new Error("Dispatch failed"));

    const descriptionResults = activities.map((activity) => ({
      activityId: activity.id,
      descriptions: [{ description: "A code snippet", kind: "code" as const }],
    }));

    const results = await generateCustomVisualContentStep(activities, descriptionResults);

    expect(results).toHaveLength(1);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateVisualContent" }),
    );
  });
});
