import { randomUUID } from "node:crypto";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { type generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { type generateStepImages } from "../steps/_utils/generate-step-images";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { customActivityWorkflow } from "./custom-workflow";

function createPromptResult(
  steps: { title: string; text: string }[],
): Awaited<ReturnType<typeof generateStepImagePrompts>> {
  return {
    data: {
      prompts: steps.map((step) => `A lesson illustration for ${step.title}`),
    },
    systemPrompt: "test",
    usage: {} as Awaited<ReturnType<typeof generateStepImagePrompts>>["usage"],
    userPrompt: "test",
  };
}

function createImageResult(prompts: string[]): Awaited<ReturnType<typeof generateStepImages>> {
  return prompts.map((prompt, index) => ({
    prompt,
    url: `https://example.com/custom-workflow-${index}.webp`,
  }));
}

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

vi.mock("@zoonk/ai/tasks/steps/image-prompts", () => ({
  generateStepImagePrompts: vi
    .fn()
    .mockImplementation(({ steps }: { steps: { title: string; text: string }[] }) =>
      Promise.resolve(createPromptResult(steps)),
    ),
}));

vi.mock("../steps/_utils/generate-step-images", () => ({
  generateStepImages: vi
    .fn()
    .mockImplementation(({ prompts }: { prompts: string[] }) =>
      Promise.resolve(createImageResult(prompts)),
    ),
}));

async function fetchLessonActivities(lessonId: string): Promise<LessonActivity[]> {
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

  return activities.map((activity) => ({ ...activity, id: activity.id }));
}

describe(customActivityWorkflow, () => {
  let organizationId: string;
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

  test("creates readable steps with embedded images for custom activity", async () => {
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
    await customActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });
    const staticSteps = steps.filter((step) => step.kind === "static");

    expect(steps).toHaveLength(2);

    expect(staticSteps[0]?.content).toEqual({
      image: {
        prompt: "A lesson illustration for Custom Step 1",
        url: "https://example.com/custom-workflow-0.webp",
      },
      text: "Custom step 1 text",
      title: "Custom Step 1",
      variant: "text",
    });
    expect(staticSteps[0]?.position).toBe(0);

    expect(staticSteps[1]?.content).toEqual({
      image: {
        prompt: "A lesson illustration for Custom Step 2",
        url: "https://example.com/custom-workflow-1.webp",
      },
      text: "Custom step 2 text",
      title: "Custom Step 2",
      variant: "text",
    });
    expect(staticSteps[1]?.position).toBe(1);
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
    await customActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("marks custom as 'failed' when AI throws", async () => {
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
    await customActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
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
    await customActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    expect(generateActivityCustom).toHaveBeenCalledTimes(2);

    const [dbActivity1, dbActivity2] = await Promise.all([
      prisma.activity.findUnique({ where: { id: activity1.id } }),
      prisma.activity.findUnique({ where: { id: activity2.id } }),
    ]);

    expect(dbActivity1?.generationStatus).toBe("completed");
    expect(dbActivity2?.generationStatus).toBe("completed");
  });
});
