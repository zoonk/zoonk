import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { dispatchVisualContent } from "../steps/_utils/dispatch-visual-content";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { explanationActivityWorkflow } from "./explanation-workflow";

function getStreamedMessages(): Record<string, string>[] {
  return getStreamedEvents() as Record<string, string>[];
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
          visual: {
            description:
              "Two frames: your thumb tapping send, then the photo visible in the friend's chat.",
            kind: "image" as const,
          },
        },
        {
          text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
          title: "Os rótulos escondidos",
          visual: {
            description: "Same two frames with a blurred row of unlabeled wrappers between them.",
            kind: "image" as const,
          },
        },
        {
          text: "Here are the wrappers, in the order they get added: the app wrapper, the transport wrapper, the network wrapper. Each layer adds a label for a different job.",
          title: "A pilha",
          visual: {
            description: "Nested packet with stacked layer labels: app, transport, network.",
            kind: "diagram" as const,
          },
        },
        {
          text: "Zoom in on the network wrapper: it only carries routing info — where to send next. The chat content stays sealed inside, untouched by routers.",
          title: "O rótulo de rede",
          visual: {
            description: "Close-up of the network wrapper with a routing address highlighted.",
            kind: "diagram" as const,
          },
        },
      ],
      predict: [
        {
          options: [
            {
              feedback: "Yes. Each wrapper handles a different job during the trip.",
              isCorrect: true,
              text: "Because each layer needs its own information",
            },
            {
              feedback: "Not this. Layers are functional, not decorative.",
              isCorrect: false,
              text: "Because extra labels make the packet prettier",
            },
          ],
          question: "Why wrap the same photo with several labels?",
          step: "Os rótulos escondidos",
        },
        {
          options: [
            {
              feedback: "Right. Routers only read where the packet goes next.",
              isCorrect: true,
              text: "The network label",
            },
            {
              feedback: "No. Routers do not open the full chat message.",
              isCorrect: false,
              text: "The full chat content",
            },
          ],
          question: "Which part does a router mainly use?",
          step: "O rótulo de rede",
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

vi.mock("../steps/_utils/dispatch-visual-content", () => ({
  dispatchVisualContent: vi
    .fn()
    .mockImplementation(
      ({ descriptions }: { descriptions: { description: string; kind: string }[] }) =>
        Promise.resolve(
          descriptions.map((description, index) =>
            index === 0
              ? {
                  kind: "image",
                  prompt: description.description,
                  url: "https://example.com/packet.webp",
                }
              : {
                  edges: [{ source: "message", target: "packet" }],
                  kind: "diagram",
                  nodes: [
                    { id: "message", label: "Message" },
                    { id: "packet", label: "Packet with labels" },
                  ],
                },
          ),
        ),
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

  test("creates the ordered explanation flow with static, visual, and predict steps", async () => {
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
      [1, "visual"],
      [2, "static"],
      [3, "visual"],
      [4, "multipleChoice"],
      [5, "static"],
      [6, "visual"],
      [7, "static"],
      [8, "visual"],
      [9, "multipleChoice"],
      [10, "static"],
    ]);

    expect(steps[0]?.content).toEqual({
      text: "You send a photo on WhatsApp. In under a second, it appears on your friend's screen, even if you're on the bus.",
      title: "O envio",
      variant: "text",
    });
    expect(steps[2]?.content).toEqual({
      text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
      title: "Os rótulos escondidos",
      variant: "text",
    });
    expect(steps[4]?.kind).toBe("multipleChoice");
    expect(steps[10]?.content).toEqual({
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

  test("marks the activity as failed when visual generation throws", async () => {
    vi.mocked(dispatchVisualContent).mockRejectedValueOnce(new Error("visual failure"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Visual Failure"],
      organizationId,
      title: `Visual Failure Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: "Visual Failure",
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

  test("streams entity ids for visual generation and save steps, but not for batch content generation", async () => {
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

    for (const stepName of ["generateVisualContent", "saveExplanationActivity"]) {
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
