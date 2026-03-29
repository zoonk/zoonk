import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateVisualsForActivityStep } from "./generate-visuals-step";

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

describe(generateVisualsForActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Visuals Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns visual rows positioned after their content steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visuals Content ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const contentSteps = [
      { text: "Step 1 text", title: "Step 1" },
      { text: "Step 2 text", title: "Step 2" },
    ];

    const aiVisuals = [
      { kind: "code" as const, language: "typescript", snippet: "const x = 1;", stepIndex: 0 },
      { kind: "image" as const, prompt: "a diagram", stepIndex: 1 },
    ];

    generateStepVisualsMock.mockResolvedValue({ data: { visuals: aiVisuals } });

    const result = await generateVisualsForActivityStep(activity, contentSteps);

    expect(result.visuals).toEqual(aiVisuals);
    expect(result.visualRows).toHaveLength(2);

    expect(result.visualRows[0]).toMatchObject({
      activityId: activity.id,
      kind: "visual",
      position: 1,
    });

    expect(result.visualRows[1]).toMatchObject({
      activityId: activity.id,
      kind: "visual",
      position: 3,
    });
  });

  test("returns empty visuals when steps are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visuals Empty ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const result = await generateVisualsForActivityStep(activity, []);

    expect(result).toEqual({ visualRows: [], visuals: [] });
    expect(generateStepVisualsMock).not.toHaveBeenCalled();
  });

  test("throws when AI returns null result", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visuals Null ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    generateStepVisualsMock.mockResolvedValue(null);

    await expect(
      generateVisualsForActivityStep(activity, [{ text: "text", title: "title" }]),
    ).rejects.toThrow("Empty AI result for visual generation");
  });

  test("throws when visual coverage does not match content step count", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visuals Mismatch ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const contentSteps = [
      { text: "Step 1", title: "Step 1" },
      { text: "Step 2", title: "Step 2" },
    ];

    generateStepVisualsMock.mockResolvedValue({
      data: {
        visuals: [{ kind: "code", language: "js", snippet: "x", stepIndex: 0 }],
      },
    });

    await expect(generateVisualsForActivityStep(activity, contentSteps)).rejects.toThrow(
      "Invalid visual coverage",
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Visuals Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    generateStepVisualsMock.mockResolvedValue({
      data: {
        visuals: [{ kind: "code", language: "js", snippet: "x", stepIndex: 0 }],
      },
    });

    await generateVisualsForActivityStep(activity, [{ text: "text", title: "title" }]);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "started",
        step: "generateVisuals",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "completed",
        step: "generateVisuals",
      }),
    );
  });
});
