import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { backgroundActivityWorkflow } from "./background-workflow";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/core/background", () => ({
  generateActivityBackground: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Background step 1 text", title: "Background Step 1" },
        { text: "Background step 2 text", title: "Background Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/visual", () => ({
  generateStepVisuals: vi.fn().mockResolvedValue({
    data: {
      visuals: [
        { kind: "image", prompt: "A visual prompt for step 1", stepIndex: 0 },
        { code: "const x = 1;", kind: "code", language: "typescript", stepIndex: 1 },
      ],
    },
  }),
}));

vi.mock("@zoonk/core/steps/visual-image", () => ({
  generateVisualStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/image.webp",
    error: null,
  }),
}));

describe("background activity workflow", () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `BG WF Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates steps in database with correct content", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `BG Content Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Background ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await backgroundActivityWorkflow(activities, "test-run-id", concepts, []);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.isPublished).toBeTruthy();
    }

    expect(steps[0]?.content).toEqual({
      text: "Background step 1 text",
      title: "Background Step 1",
      variant: "text",
    });
    expect(steps[1]?.content).toEqual({
      text: "Background step 2 text",
      title: "Background Step 2",
      variant: "text",
    });
  });

  test("sets background status to 'completed' after full pipeline", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `BG Completed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Background ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await backgroundActivityWorkflow(activities, "test-run-id", concepts, []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets background status to 'failed' when AI generation throws", async () => {
    vi.mocked(generateActivityBackground).mockRejectedValueOnce(new Error("AI generation failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `BG Failed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Background ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await backgroundActivityWorkflow(activities, "test-run-id", concepts, []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("skips generation if activity is already completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `BG Skip Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Background ${randomUUID()}`,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "Existing text", title: "Existing Step", variant: "text" },
      position: 0,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await backgroundActivityWorkflow(activities, "test-run-id", concepts, []);

    expect(generateActivityBackground).not.toHaveBeenCalled();
  });

  test("re-runs failed background when re-triggered", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Retry Failed BG Lesson ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "failed",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Failed BG Retry ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await backgroundActivityWorkflow(activities, "test-run-id", concepts, []);

    expect(generateActivityBackground).toHaveBeenCalled();
  });

  test("creates steps with image visuals including generated URL", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `BG Image Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "background",
      lessonId: testLesson.id,
      organizationId,
      title: `Background ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await backgroundActivityWorkflow(activities, "test-run-id", concepts, []);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps[0]?.visualKind).toBe("image");
    expect(steps[0]?.visualContent).toEqual({
      prompt: "A visual prompt for step 1",
      url: "https://example.com/image.webp",
    });
  });
});
