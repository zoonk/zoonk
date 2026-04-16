import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateStepVisualDescriptions } from "@zoonk/ai/tasks/steps/visual-descriptions";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { getString } from "@zoonk/utils/json";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { dispatchVisualContent } from "../steps/_utils/dispatch-visual-content";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { explanationActivityWorkflow } from "./explanation-workflow";

function createDescriptionsResult(
  steps: { title: string; text: string }[],
): Awaited<ReturnType<typeof generateStepVisualDescriptions>> {
  return {
    data: {
      descriptions: steps.map((step, index) =>
        index === 0
          ? { description: `A visual prompt for ${step.title}`, kind: "image" as const }
          : { description: `A code snippet for ${step.title}`, kind: "code" as const },
      ),
    },
    systemPrompt: "test",
    usage: {} as Awaited<ReturnType<typeof generateStepVisualDescriptions>>["usage"],
    userPrompt: "test",
  };
}

function createDispatchResult(
  steps: { title: string; text: string }[],
): Awaited<ReturnType<typeof dispatchVisualContent>> {
  return steps.map((step, index) =>
    index === 0
      ? {
          kind: "image",
          prompt: `A visual prompt for ${step.title}`,
          url: "https://example.com/image.webp",
        }
      : { annotations: null, code: "const x = 1;", kind: "code", language: "typescript" },
  );
}

function getStreamedMessages(): Record<string, string>[] {
  return getStreamedEvents() as Record<string, string>[];
}

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Explanation step 1 text", title: "Explanation Step 1" },
        { text: "Explanation step 2 text", title: "Explanation Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/visual-descriptions", () => ({
  generateStepVisualDescriptions: vi
    .fn()
    .mockImplementation(({ steps }: { steps: { title: string; text: string }[] }) =>
      Promise.resolve(createDescriptionsResult(steps)),
    ),
}));

vi.mock("../steps/_utils/dispatch-visual-content", () => ({
  dispatchVisualContent: vi
    .fn()
    .mockImplementation(
      ({ descriptions }: { descriptions: { kind: string; description: string }[] }) => {
        const steps = descriptions.map((desc) => ({
          text: desc.description,
          title: desc.description,
        }));
        return Promise.resolve(createDispatchResult(steps));
      },
    ),
}));

describe("explanation activity workflow", () => {
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
      title: `Exp WF Chapter ${randomUUID()}`,
    });
  });

  test("creates explanation steps in database for each concept", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept A"],
      organizationId,
      title: `Exp Content Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Concept A",
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    // 2 static steps + 2 visual steps (interleaved)
    expect(steps).toHaveLength(4);

    for (const step of steps) {
      expect(step.isPublished).toBe(true);
    }

    const staticSteps = steps.filter((step) => step.kind === "static");
    const visualSteps = steps.filter((step) => step.kind === "visual");

    expect(staticSteps).toHaveLength(2);
    expect(visualSteps).toHaveLength(2);

    expect(staticSteps[0]?.content).toEqual({
      text: "Explanation step 1 text",
      title: "Explanation Step 1",
      variant: "text",
    });
    expect(staticSteps[1]?.content).toEqual({
      text: "Explanation step 2 text",
      title: "Explanation Step 2",
      variant: "text",
    });

    // Static steps at even positions, visual steps at odd positions
    expect(staticSteps[0]?.position).toBe(0);
    expect(visualSteps[0]?.position).toBe(1);
    expect(staticSteps[1]?.position).toBe(2);
    expect(visualSteps[1]?.position).toBe(3);
  });

  test("sets explanation status to 'completed' after full pipeline", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept B"],
      organizationId,
      title: `Exp Completed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Concept B",
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("marks explanation as 'failed' when AI throws", async () => {
    vi.mocked(generateActivityExplanation).mockRejectedValueOnce(
      new Error("Explanation generation failed"),
    );

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept C"],
      organizationId,
      title: `Exp Failed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Concept C",
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("marks activity as failed when visual dispatch throws", async () => {
    vi.mocked(dispatchVisualContent).mockRejectedValueOnce(new Error("Visual dispatch failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept Dispatch Failure"],
      organizationId,
      title: `Exp Dispatch Fail Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Concept Dispatch Failure",
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const [dbActivity, steps] = await Promise.all([
      prisma.activity.findUnique({
        where: { id: activity.id },
      }),
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      }),
    ]);

    expect(dbActivity?.generationStatus).toBe("failed");
    expect(steps).toHaveLength(0);
  });

  test("completes when the model returns no visuals", async () => {
    vi.mocked(dispatchVisualContent).mockResolvedValueOnce([]);

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept Without Visuals"],
      organizationId,
      title: `Exp No Visuals Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Concept Without Visuals",
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const [dbActivity, steps] = await Promise.all([
      prisma.activity.findUnique({
        where: { id: activity.id },
      }),
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      }),
    ]);

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(steps.filter((step) => step.kind === "static")).toHaveLength(2);
    expect(steps.filter((step) => step.kind === "visual")).toHaveLength(0);
  });

  test("returns explanation results array", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept D"],
      organizationId,
      title: `Exp Results Lesson ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Concept D",
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const concepts = activities[0]?.lesson?.concepts ?? [];

    const { results } = await explanationActivityWorkflow({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.concept).toBe("Concept D");
    expect(results[0]?.steps).toEqual([
      { text: "Explanation step 1 text", title: "Explanation Step 1" },
      { text: "Explanation step 2 text", title: "Explanation Step 2" },
    ]);
  });

  test("skips if already completed", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept E"],
      organizationId,
      title: `Exp Skip Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: "Concept E",
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "Existing text", title: "Existing Step", variant: "text" },
      position: 0,
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow({
      activitiesToGenerate: [],
      allActivities: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    expect(generateActivityExplanation).not.toHaveBeenCalled();
  });

  describe("multi-explanation behavior", () => {
    test("generates multiple explanation activities in parallel", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept A", "Concept B", "Concept C"],
        organizationId,
        title: `Multi Exp Lesson ${randomUUID()}`,
      });

      const [expA, expB, expC] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Concept A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Concept B",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Concept C",
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        concepts,
        neighboringConcepts: [],
        workflowRunId: "test-run-id",
      });

      expect(generateActivityExplanation).toHaveBeenCalledTimes(3);

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept A",
          neighboringConcepts: ["Concept B", "Concept C"],
        }),
      );

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept B",
          neighboringConcepts: ["Concept A", "Concept C"],
        }),
      );

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept C",
          neighboringConcepts: ["Concept A", "Concept B"],
        }),
      );

      const [dbA, dbB, dbC] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expA.id } }),
        prisma.activity.findUnique({ where: { id: expB.id } }),
        prisma.activity.findUnique({ where: { id: expC.id } }),
      ]);

      expect(dbA?.generationStatus).toBe("completed");
      expect(dbB?.generationStatus).toBe("completed");
      expect(dbC?.generationStatus).toBe("completed");
    });

    test("merges other lesson concepts with neighboring concepts", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Concept A", "Concept B"],
        organizationId,
        title: `Merge Concepts Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Concept A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Concept B",
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        concepts,
        neighboringConcepts: ["Neighbor X", "Neighbor Y"],
        workflowRunId: "test-run-id",
      });

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept A",
          neighboringConcepts: ["Concept B", "Neighbor X", "Neighbor Y"],
        }),
      );

      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: "Concept B",
          neighboringConcepts: ["Concept A", "Neighbor X", "Neighbor Y"],
        }),
      );
    });

    test("per-entity step events include entityId, batch step events do not", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Entity A", "Entity B"],
        organizationId,
        title: `EntityId SSE Lesson ${randomUUID()}`,
      });

      const [expA, expB] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Entity A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Entity B",
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        concepts,
        neighboringConcepts: [],
        workflowRunId: "test-run-id",
      });

      const streamedMessages = getStreamedMessages();
      const activityIds = new Set([Number(expA.id), Number(expB.id)]);

      // Per-entity steps must include entityId matching one of the activity IDs
      const perEntitySteps = [
        "generateVisualDescriptions",
        "generateVisualContent",
        "saveExplanationActivity",
      ];

      for (const stepName of perEntitySteps) {
        const stepMessages = streamedMessages.filter((msg) => msg.step === stepName);
        expect(stepMessages.length).toBeGreaterThan(0);

        for (const msg of stepMessages) {
          expect(msg.entityId).toBeDefined();
          expect(activityIds.has(Number(msg.entityId))).toBe(true);
        }
      }

      // Batch step (generateExplanationContent) should NOT have entityId
      const batchMessages = streamedMessages.filter(
        (msg) => msg.step === "generateExplanationContent",
      );
      expect(batchMessages.length).toBeGreaterThan(0);

      for (const msg of batchMessages) {
        expect(msg.entityId).toBeUndefined();
      }
    });

    test("one explanation failure doesn't block others", async () => {
      vi.mocked(generateActivityExplanation).mockImplementation(async (params) => {
        if (params.concept === "Fail Concept") {
          throw new Error("First explanation failed");
        }
        return {
          data: { steps: [{ text: "Second exp text", title: "Second Exp" }] },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
          userPrompt: "test",
        };
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Fail Concept", "Pass Concept"],
        organizationId,
        title: `Partial Exp Fail Lesson ${randomUUID()}`,
      });

      const [failExp, passExp] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Fail Concept",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Pass Concept",
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        concepts,
        neighboringConcepts: [],
        workflowRunId: "test-run-id",
      });

      const [dbFail, dbPass] = await Promise.all([
        prisma.activity.findUnique({ where: { id: failExp.id } }),
        prisma.activity.findUnique({ where: { id: passExp.id } }),
      ]);

      expect(dbFail?.generationStatus).toBe("failed");
      expect(dbPass?.generationStatus).toBe("completed");
    });
  });

  describe("explanation visuals and images", () => {
    test("generates visuals for each explanation activity", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Visual Concept A", "Visual Concept B"],
        organizationId,
        title: `Exp Visuals Lesson ${randomUUID()}`,
      });

      await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Visual Concept A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Visual Concept B",
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        concepts,
        neighboringConcepts: [],
        workflowRunId: "test-run-id",
      });

      const calls = vi.mocked(generateStepVisualDescriptions).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    test("generates images for explanation activities", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Image Exp Concept"],
        organizationId,
        title: `Exp Images Lesson ${randomUUID()}`,
      });

      const expActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        position: 1,
        title: "Image Exp Concept",
      });

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        concepts,
        neighboringConcepts: [],
        workflowRunId: "test-run-id",
      });

      const expSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: expActivity.id },
      });

      const imageStep = expSteps.find(
        (step) => step.kind === "visual" && getString(step.content, "kind") === "image",
      );

      expect(imageStep).toBeDefined();
      expect(imageStep?.content).toEqual(
        expect.objectContaining({
          kind: "image",
          prompt: expect.any(String),
          url: "https://example.com/image.webp",
        }),
      );
    });
  });

  describe("saveExplanationActivity", () => {
    test("completes multiple explanation activities in parallel", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["Complete A", "Complete B", "Complete C"],
        organizationId,
        title: `Multi Exp Complete Lesson ${randomUUID()}`,
      });

      const [expA, expB, expC] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: "Complete A",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: "Complete B",
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: "Complete C",
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        concepts,
        neighboringConcepts: [],
        workflowRunId: "test-run-id",
      });

      const [dbA, dbB, dbC] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expA.id } }),
        prisma.activity.findUnique({ where: { id: expB.id } }),
        prisma.activity.findUnique({ where: { id: expC.id } }),
      ]);

      expect(dbA?.generationStatus).toBe("completed");
      expect(dbB?.generationStatus).toBe("completed");
      expect(dbC?.generationStatus).toBe("completed");

      const streamedMessages = getStreamedMessages();

      expect(streamedMessages).toContainEqual(
        expect.objectContaining({
          status: "completed",
          step: "saveExplanationActivity",
        }),
      );
    });

    test("sets explanation to 'failed' when generateActivityExplanation rejects for one of multiple explanations", async () => {
      const failConcept = `Exp Fail ${randomUUID()}`;

      vi.mocked(generateActivityExplanation).mockImplementation(async (params) => {
        if (params.concept === failConcept) {
          throw new Error("AI generation failed");
        }
        return {
          data: {
            steps: [{ text: "Step text", title: "Step Title" }],
          },
          systemPrompt: "test",
          usage: {} as Awaited<ReturnType<typeof generateActivityExplanation>>["usage"],
          userPrompt: "test",
        };
      });

      const okConcept1 = `Exp OK 1 ${randomUUID()}`;
      const okConcept2 = `Exp OK 2 ${randomUUID()}`;

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: [okConcept1, failConcept, okConcept2],
        organizationId,
        title: `Partial Exp Fail Lesson ${randomUUID()}`,
      });

      const [expA, expB, expC] = await Promise.all([
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 1,
          title: okConcept1,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 2,
          title: failConcept,
        }),
        activityFixture({
          generationStatus: "pending",
          kind: "explanation",
          lessonId: testLesson.id,
          organizationId,
          position: 3,
          title: okConcept2,
        }),
      ]);

      const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow({
        activitiesToGenerate: activities,
        allActivities: activities,
        concepts,
        neighboringConcepts: [],
        workflowRunId: "test-run-id",
      });

      const [dbA, dbB, dbC] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expA.id } }),
        prisma.activity.findUnique({ where: { id: expB.id } }),
        prisma.activity.findUnique({ where: { id: expC.id } }),
      ]);

      expect(dbA?.generationStatus).toBe("completed");
      expect(dbB?.generationStatus).toBe("failed");
      expect(dbC?.generationStatus).toBe("completed");

      const streamedMessages = getStreamedMessages();

      expect(streamedMessages).toContainEqual({
        status: "error",
        step: "generateExplanationContent",
      });

      expect(streamedMessages).not.toContainEqual({
        status: "completed",
        step: "generateExplanationContent",
      });
    });

    test("streams error when activity save fails due to DB constraint", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        concepts: ["DB Fail Concept"],
        organizationId,
        title: `Complete DB Fail Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: "DB Fail Concept",
      });

      const constraintName = `prevent_completion_${randomUUID().replaceAll("-", "")}`;

      await prisma.$executeRawUnsafe(
        `ALTER TABLE activities ADD CONSTRAINT ${constraintName} CHECK (NOT (id = ${String(activity.id)} AND generation_status = 'completed'))`,
      );

      try {
        const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });
        const concepts = activities[0]?.lesson?.concepts ?? [];

        await explanationActivityWorkflow({
          activitiesToGenerate: activities,
          allActivities: activities,
          concepts,
          neighboringConcepts: [],
          workflowRunId: "test-run-id",
        });

        const dbActivity = await prisma.activity.findUnique({
          where: { id: activity.id },
        });

        expect(dbActivity?.generationStatus).toBe("failed");

        const streamedMessages = getStreamedMessages();

        expect(streamedMessages).toContainEqual(
          expect.objectContaining({
            status: "error",
            step: "saveExplanationActivity",
          }),
        );

        expect(streamedMessages).not.toContainEqual({
          status: "completed",
          step: "saveExplanationActivity",
        });
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE activities DROP CONSTRAINT IF EXISTS ${constraintName}`,
        );
      }
    });
  });
});
