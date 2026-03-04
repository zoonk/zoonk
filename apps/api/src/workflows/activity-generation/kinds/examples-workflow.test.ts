import { randomUUID } from "node:crypto";
import { generateActivityExamples } from "@zoonk/ai/tasks/activities/core/examples";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { examplesActivityWorkflow } from "./examples-workflow";

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

vi.mock("@zoonk/ai/tasks/activities/core/examples", () => ({
  generateActivityExamples: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Examples step 1 text", title: "Examples Step 1" },
        { text: "Examples step 2 text", title: "Examples Step 2" },
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

describe("examples activity workflow", () => {
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
      title: `Ex WF Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates examples steps in database", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Ex Content Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "examples",
      lessonId: testLesson.id,
      organizationId,
      title: `Examples ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await examplesActivityWorkflow(activities, "test-run-id", concepts, []);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.isPublished).toBeTruthy();
    }

    expect(steps[0]?.content).toEqual({
      text: "Examples step 1 text",
      title: "Examples Step 1",
      variant: "text",
    });
    expect(steps[1]?.content).toEqual({
      text: "Examples step 2 text",
      title: "Examples Step 2",
      variant: "text",
    });
  });

  test("sets examples status to 'completed' after full pipeline", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Ex Completed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "examples",
      lessonId: testLesson.id,
      organizationId,
      title: `Examples ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await examplesActivityWorkflow(activities, "test-run-id", concepts, []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets examples status to 'failed' when concepts are empty", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: [],
      organizationId,
      title: `Ex No Concepts Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "examples",
      lessonId: testLesson.id,
      organizationId,
      title: `Examples ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await examplesActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets examples status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityExamples).mockRejectedValueOnce(
      new Error("Examples generation failed"),
    );

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Ex Failed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "examples",
      lessonId: testLesson.id,
      organizationId,
      title: `Examples ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await examplesActivityWorkflow(activities, "test-run-id", concepts, []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("skips if already completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Ex Skip Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      kind: "examples",
      lessonId: testLesson.id,
      organizationId,
      title: `Examples ${randomUUID()}`,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "Existing text", title: "Existing Step", variant: "text" },
      position: 0,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await examplesActivityWorkflow(activities, "test-run-id", concepts, []);

    expect(generateActivityExamples).not.toHaveBeenCalled();
  });
});
