import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomVisualsStep } from "./generate-custom-visuals-step";

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

const { generateStepVisualsMock } = vi.hoisted(() => ({
  generateStepVisualsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/steps/visual", () => ({
  generateStepVisuals: generateStepVisualsMock,
}));

describe(generateCustomVisualsStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Custom Visuals Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns visual results for each custom activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Visuals ${randomUUID()}`,
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

    const aiVisuals = [
      { kind: "code" as const, language: "typescript", snippet: "const x = 1;", stepIndex: 0 },
    ];

    generateStepVisualsMock.mockResolvedValue({ data: { visuals: aiVisuals } });

    const results = await generateCustomVisualsStep(activities, contentResults);

    expect(results).toHaveLength(1);
    expect(results[0]?.activityId).toBe(activity.id);
    expect(results[0]?.visuals).toEqual(aiVisuals);
    expect(results[0]?.visualRows).toHaveLength(1);
    expect(results[0]?.visualRows[0]).toMatchObject({
      activityId: activity.id,
      kind: "visual",
      position: 1,
    });
  });

  test("returns empty array when content results are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Visuals Empty ${randomUUID()}`,
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

    const results = await generateCustomVisualsStep(activities, []);

    expect(results).toEqual([]);
  });

  test("returns empty visuals for an activity with empty content steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Visuals No Steps ${randomUUID()}`,
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

    const results = await generateCustomVisualsStep(activities, contentResults);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      activityId: activity.id,
      visualRows: [],
      visuals: [],
    });
    expect(generateStepVisualsMock).not.toHaveBeenCalled();
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Visuals Stream ${randomUUID()}`,
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

    generateStepVisualsMock.mockResolvedValue({
      data: {
        visuals: [{ kind: "code", language: "js", snippet: "x", stepIndex: 0 }],
      },
    });

    await generateCustomVisualsStep(activities, [
      { activityId: activity.id, steps: [{ text: "text", title: "title" }] },
    ]);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateVisuals" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateVisuals" }),
    );
  });

  test("streams error status when some AI calls fail", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Custom Visuals Error ${randomUUID()}`,
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

    generateStepVisualsMock
      .mockResolvedValueOnce({
        data: {
          visuals: [{ kind: "code", language: "js", snippet: "x", stepIndex: 0 }],
        },
      })
      .mockResolvedValueOnce(null);

    const contentResults = activities.map((a) => ({
      activityId: a.id,
      steps: [{ text: "text", title: "title" }],
    }));

    const results = await generateCustomVisualsStep(activities, contentResults);

    expect(results).toHaveLength(1);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateVisuals" }),
    );
  });
});
