import { randomUUID } from "node:crypto";
import { generateActivityStoryDebrief } from "@zoonk/ai/tasks/activities/core/story-debrief";
import { generateActivityStorySteps } from "@zoonk/ai/tasks/activities/core/story-steps";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { getString } from "@zoonk/utils/json";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { storyActivityWorkflow } from "./story-workflow";

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

const { mockStorySteps, mockDebriefData } = vi.hoisted(() => ({
  mockDebriefData: {
    debrief: [
      {
        explanation: "Direct communication builds trust during crises.",
        name: "Crisis Communication",
      },
      {
        explanation: "Constraints can drive innovation when embraced.",
        name: "Supply Chain Resilience",
      },
    ],
    outcomes: [
      { minStrongChoices: 2, narrative: "You turned crisis into opportunity.", title: "Excellent" },
      { minStrongChoices: 1, narrative: "You navigated the crisis reasonably.", title: "Good" },
      { minStrongChoices: 0, narrative: "The crisis overwhelmed you.", title: "Needs work" },
    ],
  },
  mockStorySteps: {
    intro: "You are a factory manager facing a supply chain crisis.",
    metrics: ["Production", "Morale", "Cash"],
    steps: [
      {
        choices: [
          {
            alignment: "strong",
            consequence: "Workers rally behind you.",
            id: "c1a",
            metricEffects: [{ effect: "positive", metric: "Morale" }],
            text: "Address the team directly",
          },
          {
            alignment: "weak",
            consequence: "Rumors spread unchecked.",
            id: "c1b",
            metricEffects: [{ effect: "negative", metric: "Morale" }],
            text: "Send an email instead",
          },
        ],
        situation: "Your main supplier just went bankrupt.",
      },
      {
        choices: [
          {
            alignment: "partial",
            consequence: "You find a reasonable alternative.",
            id: "c2a",
            metricEffects: [{ effect: "positive", metric: "Production" }],
            text: "Contact backup suppliers",
          },
          {
            alignment: "strong",
            consequence: "Innovation emerges from constraint.",
            id: "c2b",
            metricEffects: [
              { effect: "positive", metric: "Production" },
              { effect: "positive", metric: "Cash" },
            ],
            text: "Redesign the product to use different materials",
          },
        ],
        situation: "Production is halted without parts.",
      },
    ],
  },
}));

vi.mock("@zoonk/ai/tasks/activities/core/story-steps", () => ({
  generateActivityStorySteps: vi.fn().mockResolvedValue({ data: mockStorySteps }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/story-debrief", () => ({
  generateActivityStoryDebrief: vi.fn().mockResolvedValue({ data: mockDebriefData }),
}));

describe("story activity workflow", () => {
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
      title: `Story WF Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates story steps with intro, decisions, and debrief", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Supply Chain Management", "Crisis Communication"],
      organizationId,
      title: `Story Full Pipeline ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await storyActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: storyActivity.id },
    });

    // 1 intro + 2 decision steps + 1 outcome + 1 debrief = 5
    expect(steps).toHaveLength(5);

    // Intro step: static with storyIntro variant
    expect(steps[0]?.kind).toBe("static");
    expect(steps[0]?.position).toBe(0);
    expect(getString(steps[0]?.content, "variant")).toBe("storyIntro");

    // Decision steps: story kind
    expect(steps[1]?.kind).toBe("story");
    expect(steps[1]?.position).toBe(1);
    expect(steps[2]?.kind).toBe("story");
    expect(steps[2]?.position).toBe(2);

    // Outcome step: static with storyOutcome variant
    expect(steps[3]?.kind).toBe("static");
    expect(steps[3]?.position).toBe(3);
    expect(getString(steps[3]?.content, "variant")).toBe("storyOutcome");

    // Debrief step: static with storyDebrief variant
    expect(steps[4]?.kind).toBe("static");
    expect(steps[4]?.position).toBe(4);
    expect(getString(steps[4]?.content, "variant")).toBe("storyDebrief");

    for (const step of steps) {
      expect(step.isPublished).toBe(true);
    }
  });

  test("marks story as completed with generationRunId", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Story Completed ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await storyActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: storyActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("skips when no story activity exists", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Story Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: testLesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await storyActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    expect(generateActivityStorySteps).not.toHaveBeenCalled();
    expect(generateActivityStoryDebrief).not.toHaveBeenCalled();
  });

  test("marks story as failed when content generation throws", async () => {
    vi.mocked(generateActivityStorySteps).mockRejectedValueOnce(new Error("AI failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Story Content Fail ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await storyActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: storyActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivityStoryDebrief).not.toHaveBeenCalled();
  });

  test("marks story as failed when debrief generation throws", async () => {
    vi.mocked(generateActivityStoryDebrief).mockRejectedValueOnce(new Error("Debrief failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Story Debrief Fail ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await storyActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: storyActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivityStorySteps).toHaveBeenCalled();
    expect(generateActivityStoryDebrief).toHaveBeenCalled();
  });
});
