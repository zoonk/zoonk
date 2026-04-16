import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomVisualDescriptionsStep } from "./generate-custom-visuals-step";

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

const { generateStepVisualDescriptionsMock } = vi.hoisted(() => ({
  generateStepVisualDescriptionsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/steps/visual-descriptions", () => ({
  generateStepVisualDescriptions: generateStepVisualDescriptionsMock,
}));

describe(generateCustomVisualDescriptionsStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Custom Descriptions Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns visual descriptions for each custom activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Descriptions ${randomUUID()}`,
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

    const contentResults = [
      {
        activityId: activity.id,
        steps: [{ text: "Step 1 text", title: "Step 1" }],
      },
    ];

    const aiDescriptions = [
      { description: "A code snippet showing const x = 1", kind: "code" as const },
    ];

    generateStepVisualDescriptionsMock.mockResolvedValue({
      data: { descriptions: aiDescriptions },
    });

    const results = await generateCustomVisualDescriptionsStep(activities, contentResults);

    expect(results).toHaveLength(1);
    expect(results[0]?.activityId).toBe(activity.id);
    expect(results[0]?.descriptions).toEqual(aiDescriptions);
  });

  test("returns empty array when content results are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Descriptions Empty ${randomUUID()}`,
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

    const results = await generateCustomVisualDescriptionsStep(activities, []);

    expect(results).toEqual([]);
  });

  test("returns empty descriptions for an activity with empty content steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Descriptions No Steps ${randomUUID()}`,
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

    const contentResults = [{ activityId: activity.id, steps: [] }];

    const results = await generateCustomVisualDescriptionsStep(activities, contentResults);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      activityId: activity.id,
      descriptions: [],
    });
    expect(generateStepVisualDescriptionsMock).not.toHaveBeenCalled();
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Descriptions Stream ${randomUUID()}`,
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

    generateStepVisualDescriptionsMock.mockResolvedValue({
      data: {
        descriptions: [{ description: "A code snippet", kind: "code" }],
      },
    });

    await generateCustomVisualDescriptionsStep(activities, [
      { activityId: activity.id, steps: [{ text: "text", title: "title" }] },
    ]);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateVisualDescriptions" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateVisualDescriptions" }),
    );
  });

  test("streams error status when some AI calls fail", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Descriptions Error ${randomUUID()}`,
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

    generateStepVisualDescriptionsMock
      .mockResolvedValueOnce({
        data: {
          descriptions: [{ description: "A code snippet", kind: "code" }],
        },
      })
      .mockResolvedValueOnce(null);

    const contentResults = activities.map((a) => ({
      activityId: a.id,
      steps: [{ text: "text", title: "title" }],
    }));

    const results = await generateCustomVisualDescriptionsStep(activities, contentResults);

    expect(results).toHaveLength(1);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateVisualDescriptions" }),
    );
  });
});
