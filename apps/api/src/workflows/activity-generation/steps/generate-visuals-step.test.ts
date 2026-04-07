import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateVisualDescriptionsForActivityStep } from "./generate-visuals-step";

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

describe(generateVisualDescriptionsForActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Descriptions Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns visual descriptions for each step", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Descriptions Content ${randomUUID()}`,
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

    const aiDescriptions = [
      { description: "A code snippet showing const x = 1", kind: "code" as const },
      { description: "A visual showing a diagram concept", kind: "image" as const },
    ];

    generateStepVisualDescriptionsMock.mockResolvedValue({
      data: { descriptions: aiDescriptions },
    });

    const result = await generateVisualDescriptionsForActivityStep(activity, contentSteps);

    expect(result.descriptions).toEqual(aiDescriptions);
  });

  test("returns empty descriptions when steps are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Descriptions Empty ${randomUUID()}`,
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

    const result = await generateVisualDescriptionsForActivityStep(activity, []);

    expect(result).toEqual({ descriptions: [] });
    expect(generateStepVisualDescriptionsMock).not.toHaveBeenCalled();
  });

  test("throws when AI returns null result", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Descriptions Null ${randomUUID()}`,
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

    generateStepVisualDescriptionsMock.mockResolvedValue(null);

    await expect(
      generateVisualDescriptionsForActivityStep(activity, [{ text: "text", title: "title" }]),
    ).rejects.toThrow("Empty AI result for visual description generation");
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Descriptions Stream ${randomUUID()}`,
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

    generateStepVisualDescriptionsMock.mockResolvedValue({
      data: {
        descriptions: [{ description: "A code snippet", kind: "code" }],
      },
    });

    await generateVisualDescriptionsForActivityStep(activity, [{ text: "text", title: "title" }]);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "started",
        step: "generateVisualDescriptions",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "completed",
        step: "generateVisualDescriptions",
      }),
    );
  });
});
