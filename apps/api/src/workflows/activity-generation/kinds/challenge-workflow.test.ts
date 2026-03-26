import { randomUUID } from "node:crypto";
import { generateActivityChallenge } from "@zoonk/ai/tasks/activities/core/challenge";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { challengeActivityWorkflow } from "./challenge-workflow";

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

vi.mock("@zoonk/ai/tasks/activities/core/challenge", () => ({
  generateActivityChallenge: vi.fn().mockResolvedValue({
    data: {
      intro: "Welcome to the challenge scenario...",
      reflection: "Every decision involves trade-offs...",
      steps: [
        {
          context: "Your team lead asks you to choose...",
          options: [
            {
              consequence: "Great outcome",
              effects: [{ dimension: "Quality", impact: "positive" }],
              text: "Option A",
            },
            {
              consequence: "Mixed outcome",
              effects: [{ dimension: "Speed", impact: "positive" }],
              text: "Option B",
            },
            {
              consequence: "Poor outcome",
              effects: [{ dimension: "Quality", impact: "negative" }],
              text: "Option C",
            },
          ],
          question: "What approach do you take?",
        },
      ],
    },
  }),
}));

describe("challenge activity workflow", () => {
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
      title: `Challenge WF Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates challenge steps (intro, multipleChoice, reflection)", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Challenge Content Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      lessonId: testLesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await challengeActivityWorkflow({
      activitiesToGenerate: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(3);

    expect(steps[0]?.kind).toBe("static");
    expect(steps[0]?.content).toEqual({
      text: "Welcome to the challenge scenario...",
      title: "",
      variant: "text",
    });

    expect(steps[1]?.kind).toBe("multipleChoice");
    expect(steps[1]?.content).toEqual({
      context: "Your team lead asks you to choose...",
      kind: "challenge",
      options: [
        {
          consequence: "Great outcome",
          effects: [{ dimension: "Quality", impact: "positive" }],
          text: "Option A",
        },
        {
          consequence: "Mixed outcome",
          effects: [{ dimension: "Speed", impact: "positive" }],
          text: "Option B",
        },
        {
          consequence: "Poor outcome",
          effects: [{ dimension: "Quality", impact: "negative" }],
          text: "Option C",
        },
      ],
      question: "What approach do you take?",
    });

    expect(steps[2]?.kind).toBe("static");
    expect(steps[2]?.content).toEqual({
      text: "Every decision involves trade-offs...",
      title: "",
      variant: "text",
    });
  });

  test("sets challenge status to 'completed' after saving", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Challenge Completed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      lessonId: testLesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await challengeActivityWorkflow({
      activitiesToGenerate: activities,
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

  test("sets challenge status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityChallenge).mockRejectedValueOnce(
      new Error("Challenge generation failed"),
    );

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Challenge Failed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      lessonId: testLesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await challengeActivityWorkflow({
      activitiesToGenerate: activities,
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets challenge status to 'failed' when concepts are empty", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: [],
      organizationId,
      title: `Challenge No Concepts Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      lessonId: testLesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await challengeActivityWorkflow({
      activitiesToGenerate: activities,
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

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
      title: `Challenge Skip Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      kind: "challenge",
      lessonId: testLesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    await stepFixture({
      activityId: activity.id,
      content: { text: "Existing intro", title: "", variant: "text" },
      kind: "static",
      position: 0,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await challengeActivityWorkflow({
      activitiesToGenerate: [],
      concepts,
      neighboringConcepts: [],
      workflowRunId: "test-run-id",
    });

    expect(generateActivityChallenge).not.toHaveBeenCalled();
  });
});
