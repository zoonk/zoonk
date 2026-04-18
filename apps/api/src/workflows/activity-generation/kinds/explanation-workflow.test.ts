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
        text: "This is why Google Maps can keep recalculating your route while you move.",
        title: "This is why",
      },
      concepts: [
        {
          text: "Packets travel as smaller chunks so the network can handle them predictably.",
          title: "Small chunks",
          visual: null,
        },
        {
          text: "Each layer adds its own label for a different job.",
          title: "Layer labels",
          visual: {
            description:
              "A diagram of one packet with stacked labels for different network layers.",
            kind: "diagram" as const,
          },
        },
        {
          text: "Routers look at the network label, not the whole app meaning.",
          title: "Router focus",
          visual: null,
        },
      ],
      initialQuestion: {
        explanation:
          "The packet keeps gaining focused labels so each part of the network knows what to do next.",
        question: "Why doesn't internet data travel as one giant unlabeled blob?",
        visual: {
          description: "An image of a message turning into a packet with labels wrapped around it.",
          kind: "image" as const,
        },
      },
      predict: [
        {
          concept: "Layer labels",
          options: [
            {
              feedback: "Right. Different layers need different details.",
              isCorrect: true,
              text: "Because each layer needs its own information",
            },
            {
              feedback: "Not this one. The labels are functional, not decorative.",
              isCorrect: false,
              text: "Because extra labels make packets look neater",
            },
          ],
          question: "Why add more than one label to the same packet?",
        },
        {
          concept: "Router focus",
          options: [
            {
              feedback: "Yes. Routers mainly care about where the packet goes next.",
              isCorrect: true,
              text: "The network label",
            },
            {
              feedback: "No. Routers are not reading the full chat message.",
              isCorrect: false,
              text: "The app's full message",
            },
          ],
          question: "Which part does a router mainly use?",
        },
      ],
      scenario: {
        text: "You send a WhatsApp photo on the bus and it still reaches your friend after crossing many network points.",
        title: "On WhatsApp",
      },
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
      [3, "static"],
      [4, "static"],
      [5, "static"],
      [6, "visual"],
      [7, "multipleChoice"],
      [8, "static"],
      [9, "multipleChoice"],
      [10, "static"],
    ]);

    expect(steps[0]?.content).toEqual({
      text: "Why doesn't internet data travel as one giant unlabeled blob?",
      title: "",
      variant: "text",
    });
    expect(steps[2]?.content).toEqual({
      text: "The packet keeps gaining focused labels so each part of the network knows what to do next.",
      title: "",
      variant: "text",
    });
    expect(steps[7]?.kind).toBe("multipleChoice");
    expect(steps[10]?.content).toEqual({
      text: "This is why Google Maps can keep recalculating your route while you move.",
      title: "This is why",
      variant: "text",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.steps.map((step) => step.title || step.text)).toEqual([
      "Why doesn't internet data travel as one giant unlabeled blob?",
      "The packet keeps gaining focused labels so each part of the network knows what to do next.",
      "On WhatsApp",
      "Small chunks",
      "Layer labels",
      "Router focus",
      "This is why",
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
