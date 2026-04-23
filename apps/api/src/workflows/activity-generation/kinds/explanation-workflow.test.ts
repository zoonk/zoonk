import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateStepImages } from "../steps/_utils/generate-step-images";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { explanationActivityWorkflow } from "./explanation-workflow";

function getStreamedMessages(): Record<string, string>[] {
  return getStreamedEvents() as Record<string, string>[];
}

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
    url: `https://example.com/explanation-image-${index}.webp`,
  }));
}

function createExplanationResult(): Awaited<ReturnType<typeof generateActivityExplanation>> {
  return {
    data: {
      anchor: {
        text: "Every photo you send on WhatsApp uses this exact layering — you hit send, it runs.",
        title: "Every send",
      },
      explanation: [
        {
          text: "You send a photo on WhatsApp. In under a second, it appears on your friend's screen, even if you're on the bus.",
          title: "O envio",
        },
        {
          text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
          title: "Os rótulos escondidos",
        },
        {
          text: "Here are the wrappers, in the order they get added: the app wrapper, the transport wrapper, the network wrapper. Each layer adds a label for a different job.",
          title: "A pilha",
        },
        {
          text: "Zoom in on the network wrapper: it only carries routing info — where to send next. The chat content stays sealed inside, untouched by routers.",
          title: "O rótulo de rede",
        },
      ],
    },
    systemPrompt: "test",
    usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
    userPrompt: "test",
  };
}

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue(createExplanationResult()),
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

describe("explanation activity workflow", () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    const course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Explanation Workflow Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates the ordered explanation flow with embedded step images", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Encapsulation"],
      organizationId,
      title: `Explanation Flow Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: "Encapsulation",
    });

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    const { results } = await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      lessonConcepts: activities[0]?.lesson?.concepts ?? [],
      workflowRunId: "test-run-id",
    });

    const [dbActivity, steps] = await Promise.all([
      prisma.activity.findUniqueOrThrow({ where: { id: activity.id } }),
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      }),
    ]);

    expect(dbActivity.generationStatus).toBe("completed");
    expect(steps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "static"],
      [2, "static"],
      [3, "static"],
      [4, "static"],
    ]);

    expect(steps[0]?.content).toEqual({
      image: {
        prompt: "A lesson illustration for O envio",
        url: "https://example.com/explanation-image-0.webp",
      },
      text: "You send a photo on WhatsApp. In under a second, it appears on your friend's screen, even if you're on the bus.",
      title: "O envio",
      variant: "text",
    });
    expect(steps[1]?.content).toEqual({
      image: {
        prompt: "A lesson illustration for Os rótulos escondidos",
        url: "https://example.com/explanation-image-1.webp",
      },
      text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
      title: "Os rótulos escondidos",
      variant: "text",
    });
    expect(steps[4]?.content).toEqual({
      image: {
        prompt: "A lesson illustration for Every send",
        url: "https://example.com/explanation-image-4.webp",
      },
      text: "Every photo you send on WhatsApp uses this exact layering — you hit send, it runs.",
      title: "Every send",
      variant: "text",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.steps.map((step) => step.title || step.text)).toEqual([
      "O envio",
      "Os rótulos escondidos",
      "A pilha",
      "O rótulo de rede",
      "Every send",
    ]);
    expect(vi.mocked(generateStepImagePrompts)).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [
          {
            text: "You send a photo on WhatsApp. In under a second, it appears on your friend's screen, even if you're on the bus.",
            title: "O envio",
          },
          {
            text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
            title: "Os rótulos escondidos",
          },
          {
            text: "Here are the wrappers, in the order they get added: the app wrapper, the transport wrapper, the network wrapper. Each layer adds a label for a different job.",
            title: "A pilha",
          },
          {
            text: "Zoom in on the network wrapper: it only carries routing info — where to send next. The chat content stays sealed inside, untouched by routers.",
            title: "O rótulo de rede",
          },
          {
            text: "Every photo you send on WhatsApp uses this exact layering — you hit send, it runs.",
            title: "Every send",
          },
        ],
      }),
    );
    expect(vi.mocked(generateStepImages)).toHaveBeenCalledWith({
      language: activity.language,
      orgSlug: activities[0]?.lesson.chapter.course.organization?.slug,
      preset: "illustration",
      prompts: [
        "A lesson illustration for O envio",
        "A lesson illustration for Os rótulos escondidos",
        "A lesson illustration for A pilha",
        "A lesson illustration for O rótulo de rede",
        "A lesson illustration for Every send",
      ],
    });
  });

  test("returns existing static explanation steps for already completed activities", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Existing Concept"],
      organizationId,
      title: `Completed Explanation Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: "Existing Concept",
    });

    await prisma.step.createMany({
      data: [
        {
          activityId: activity.id,
          content: {
            text: "Existing question",
            title: "Existing hook",
            variant: "text",
          },
          isPublished: true,
          kind: "static",
          position: 0,
        },
        {
          activityId: activity.id,
          content: { text: "Existing explanation", title: "", variant: "text" },
          isPublished: true,
          kind: "static",
          position: 2,
        },
      ],
    });

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    const { results } = await explanationActivityWorkflow({
      activitiesToGenerate: [],
      allActivities: activities,
      lessonConcepts: activities[0]?.lesson?.concepts ?? [],
      workflowRunId: "test-run-id",
    });

    expect(generateActivityExplanation).not.toHaveBeenCalled();
    expect(results).toEqual([
      {
        activityId: activity.id,
        concept: "Existing Concept",
        steps: [
          { text: "Existing question", title: "Existing hook" },
          { text: "Existing explanation", title: "" },
        ],
      },
    ]);
  });

  test("marks the activity as failed when the explanation task throws", async () => {
    vi.mocked(generateActivityExplanation).mockRejectedValueOnce(new Error("AI failure"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Failure Concept"],
      organizationId,
      title: `Explanation Failure Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: "Failure Concept",
    });

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      lessonConcepts: activities[0]?.lesson?.concepts ?? [],
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });

    expect(dbActivity.generationStatus).toBe("failed");
  });

  test("marks the activity as failed when step image generation throws", async () => {
    vi.mocked(generateStepImages).mockRejectedValueOnce(new Error("image failure"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Image Failure"],
      organizationId,
      title: `Image Failure Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: "Image Failure",
    });

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      lessonConcepts: activities[0]?.lesson?.concepts ?? [],
      workflowRunId: "test-run-id",
    });

    const [dbActivity, steps] = await Promise.all([
      prisma.activity.findUniqueOrThrow({ where: { id: activity.id } }),
      prisma.step.findMany({ where: { activityId: activity.id } }),
    ]);

    expect(dbActivity.generationStatus).toBe("failed");
    expect(steps).toEqual([]);
  });

  test("keeps other explanation activities running when one fails", async () => {
    vi.mocked(generateActivityExplanation).mockImplementation(async ({ activityTitle }) => {
      if (activityTitle === "Broken Concept") {
        throw new Error("broken");
      }

      return createExplanationResult();
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Broken Concept", "Healthy Concept"],
      organizationId,
      title: `Partial Failure Lesson ${randomUUID()}`,
    });

    const [brokenActivity, healthyActivity] = await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: "Broken Concept",
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: "Healthy Concept",
      }),
    ]);

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      lessonConcepts: activities[0]?.lesson?.concepts ?? [],
      workflowRunId: "test-run-id",
    });

    const [brokenResult, healthyResult] = await Promise.all([
      prisma.activity.findUniqueOrThrow({ where: { id: brokenActivity.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: healthyActivity.id } }),
    ]);

    expect(brokenResult.generationStatus).toBe("failed");
    expect(healthyResult.generationStatus).toBe("completed");
  });

  test("streams entity ids for image generation and save steps, but not for batch content generation", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["First Concept", "Second Concept"],
      organizationId,
      title: `SSE Explanation Lesson ${randomUUID()}`,
    });

    const [firstActivity, secondActivity] = await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: lesson.id,
        organizationId,
        title: "First Concept",
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: "Second Concept",
      }),
    ]);

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      lessonConcepts: activities[0]?.lesson?.concepts ?? [],
      workflowRunId: "test-run-id",
    });

    const streamedMessages = getStreamedMessages();
    const activityIds = new Set([firstActivity.id, secondActivity.id]);

    for (const stepName of [
      "generateImagePrompts",
      "generateStepImages",
      "saveExplanationActivity",
    ]) {
      const stepMessages = streamedMessages.filter((message) => message.step === stepName);
      expect(stepMessages.length).toBeGreaterThan(0);

      for (const message of stepMessages) {
        expect(message.entityId).toBeDefined();
        expect(activityIds.has(message.entityId!)).toBe(true);
      }
    }

    const batchMessages = streamedMessages.filter(
      (message) => message.step === "generateExplanationContent",
    );

    expect(batchMessages.length).toBeGreaterThan(0);

    for (const message of batchMessages) {
      expect(message.entityId).toBeUndefined();
    }
  });
});
