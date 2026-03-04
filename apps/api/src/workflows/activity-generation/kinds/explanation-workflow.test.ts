import { randomUUID } from "node:crypto";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { explanationActivityWorkflow } from "./explanation-workflow";

const mockStreamWrite = vi.hoisted(() => vi.fn().mockResolvedValue(null));

function getStreamedMessages(): Record<string, string>[] {
  return mockStreamWrite.mock.calls.map(
    (call: string[]) => JSON.parse(call[0]!.replace("data: ", "").trim()) as Record<string, string>,
  );
}

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: mockStreamWrite,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

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

describe("explanation activity workflow", () => {
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
      title: `Exp WF Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.isPublished).toBeTruthy();
    }

    expect(steps[0]?.content).toEqual({
      text: "Explanation step 1 text",
      title: "Explanation Step 1",
      variant: "text",
    });
    expect(steps[1]?.content).toEqual({
      text: "Explanation step 2 text",
      title: "Explanation Step 2",
      variant: "text",
    });
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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets explanation status to 'failed' when AI throws", async () => {
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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    const { results } = await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

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

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow(activities, "test-run-id", concepts, [
        "Neighbor X",
        "Neighbor Y",
      ]);

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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

      const calls = vi.mocked(generateStepVisuals).mock.calls;
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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

      const expSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: expActivity.id },
      });

      const imageStep = expSteps.find((step) => step.visualKind === "image");

      expect(imageStep).toBeDefined();
      expect(imageStep?.visualContent).toEqual(
        expect.objectContaining({
          prompt: expect.any(String),
          url: "https://example.com/image.webp",
        }),
      );
    });
  });

  describe("completeActivityStep", () => {
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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

      const [dbA, dbB, dbC] = await Promise.all([
        prisma.activity.findUnique({ where: { id: expA.id } }),
        prisma.activity.findUnique({ where: { id: expB.id } }),
        prisma.activity.findUnique({ where: { id: expC.id } }),
      ]);

      expect(dbA?.generationStatus).toBe("completed");
      expect(dbB?.generationStatus).toBe("completed");
      expect(dbC?.generationStatus).toBe("completed");

      const streamedMessages = getStreamedMessages();

      expect(streamedMessages).toContainEqual({
        status: "completed",
        step: "setExplanationAsCompleted",
      });

      expect(streamedMessages).not.toContainEqual({
        status: "error",
        step: "setActivityAsCompleted",
      });
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

      const activities = await getLessonActivitiesStep(testLesson.id);
      const concepts = activities[0]?.lesson?.concepts ?? [];

      await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

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

      expect(streamedMessages).toContainEqual({
        status: "completed",
        step: "setExplanationAsCompleted",
      });
    });

    test("streams error when activity completion DB update fails", async () => {
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

      await prisma.$executeRawUnsafe(
        `ALTER TABLE activities ADD CONSTRAINT prevent_completion_test CHECK (NOT (id = ${String(activity.id)} AND generation_status = 'completed'))`,
      );

      try {
        const activities = await getLessonActivitiesStep(testLesson.id);
        const concepts = activities[0]?.lesson?.concepts ?? [];

        await explanationActivityWorkflow(activities, "test-run-id", concepts, []);

        const dbActivity = await prisma.activity.findUnique({
          where: { id: activity.id },
        });

        expect(dbActivity?.generationStatus).toBe("failed");

        const streamedMessages = getStreamedMessages();

        expect(streamedMessages).toContainEqual({
          status: "error",
          step: "setExplanationAsCompleted",
        });

        expect(streamedMessages).not.toContainEqual({
          status: "completed",
          step: "setExplanationAsCompleted",
        });
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE activities DROP CONSTRAINT IF EXISTS prevent_completion_test`,
        );
      }
    });
  });
});
