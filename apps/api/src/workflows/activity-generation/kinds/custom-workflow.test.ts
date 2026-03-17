import { randomUUID } from "node:crypto";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomContentStep } from "../steps/generate-custom-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { customActivityWorkflow } from "./custom-workflow";

function createStepVisualsResult(
  steps: { title: string; text: string }[],
): Awaited<ReturnType<typeof generateStepVisuals>> {
  return {
    data: {
      visuals: steps.map((step, stepIndex) =>
        stepIndex === 0
          ? { kind: "image", prompt: `A visual prompt for ${step.title}`, stepIndex }
          : {
              annotations: null,
              code: "const x = 1;",
              kind: "code",
              language: "typescript",
              stepIndex,
            },
      ),
    },
    systemPrompt: "test",
    usage: {} as Awaited<ReturnType<typeof generateStepVisuals>>["usage"],
    userPrompt: "test",
  };
}

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

vi.mock("@zoonk/ai/tasks/activities/custom", () => ({
  generateActivityCustom: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Custom step 1 text", title: "Custom Step 1" },
        { text: "Custom step 2 text", title: "Custom Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/visual", () => ({
  generateStepVisuals: vi
    .fn()
    .mockImplementation(({ steps }: { steps: { title: string; text: string }[] }) =>
      Promise.resolve(createStepVisualsResult(steps)),
    ),
}));

vi.mock("@zoonk/core/steps/visual-image", () => ({
  generateVisualStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/image.webp",
    error: null,
  }),
}));

async function fetchLessonActivities(lessonId: number): Promise<LessonActivity[]> {
  const activities = await prisma.activity.findMany({
    include: {
      _count: { select: { steps: true } },
      lesson: {
        include: {
          chapter: {
            include: {
              course: { include: { organization: true } },
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: { lessonId },
  });

  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}

describe(customActivityWorkflow, () => {
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
      title: `Custom Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates steps with visuals and images for custom activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await customActivityWorkflow(activities, "test-run-id");

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    const staticSteps = steps.filter((step) => step.kind === "static");
    const visualSteps = steps.filter((step) => step.kind === "visual");

    expect(staticSteps).toHaveLength(2);
    expect(visualSteps).toHaveLength(2);

    expect(staticSteps[0]?.content).toEqual({
      text: "Custom step 1 text",
      title: "Custom Step 1",
      variant: "text",
    });
    expect(staticSteps[0]?.position).toBe(0);

    expect(staticSteps[1]?.content).toEqual({
      text: "Custom step 2 text",
      title: "Custom Step 2",
      variant: "text",
    });
    expect(staticSteps[1]?.position).toBe(2);

    expect(visualSteps[0]?.content).toEqual(expect.objectContaining({ kind: "image" }));
    expect(visualSteps[0]?.position).toBe(1);

    expect(visualSteps[1]?.content).toEqual(expect.objectContaining({ kind: "code" }));
    expect(visualSteps[1]?.position).toBe(3);
  });

  test("sets custom status to 'completed' after saving", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await customActivityWorkflow(activities, "test-run-id");

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("sets custom status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityCustom).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await customActivityWorkflow(activities, "test-run-id");

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("fails when visuals contain out-of-range step indexes", async () => {
    vi.mocked(generateStepVisuals).mockResolvedValueOnce({
      ...createStepVisualsResult([
        { text: "Custom step 1 text", title: "Custom Step 1" },
        { text: "Custom step 2 text", title: "Custom Step 2" },
      ]),
      data: {
        visuals: [
          { kind: "image", prompt: "A visual prompt", stepIndex: 0 },
          {
            annotations: null,
            code: "const x = 1;",
            kind: "code",
            language: "typescript",
            stepIndex: 2,
          },
        ],
      },
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Invalid Visuals ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await customActivityWorkflow(activities, "test-run-id");

    const [dbActivity, steps] = await Promise.all([
      prisma.activity.findUnique({ where: { id: activity.id } }),
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      }),
    ]);

    expect(dbActivity?.generationStatus).toBe("failed");
    expect(steps.filter((step) => step.kind === "static")).toHaveLength(2);
    expect(steps.filter((step) => step.kind === "visual")).toHaveLength(0);
  });

  test("handles multiple custom activities in parallel", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Multi ${randomUUID()}`,
    });

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        description: "First custom",
        generationStatus: "pending",
        kind: "custom",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Custom One ${randomUUID()}`,
      }),
      activityFixture({
        description: "Second custom",
        generationStatus: "pending",
        kind: "custom",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Custom Two ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);
    await customActivityWorkflow(activities, "test-run-id");

    expect(generateActivityCustom).toHaveBeenCalledTimes(2);

    const [dbActivity1, dbActivity2] = await Promise.all([
      prisma.activity.findUnique({ where: { id: activity1.id } }),
      prisma.activity.findUnique({ where: { id: activity2.id } }),
    ]);

    expect(dbActivity1?.generationStatus).toBe("completed");
    expect(dbActivity2?.generationStatus).toBe("completed");
  });

  test("reuses saved static content for completed custom activities", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Resume ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "custom",
      lessonId: lesson.id,
      organizationId,
      title: `Custom ${randomUUID()}`,
    });

    const initialActivities = await fetchLessonActivities(lesson.id);
    await customActivityWorkflow(initialActivities, "test-run-id");

    vi.clearAllMocks();

    const completedActivities = await fetchLessonActivities(lesson.id);
    const contentResults = await generateCustomContentStep(completedActivities, "resume-run-id");

    expect(contentResults).toEqual([
      {
        activityId: completedActivities[0]?.id,
        steps: [
          { text: "Custom step 1 text", title: "Custom Step 1" },
          { text: "Custom step 2 text", title: "Custom Step 2" },
        ],
      },
    ]);
    expect(generateActivityCustom).not.toHaveBeenCalled();
  });
});
