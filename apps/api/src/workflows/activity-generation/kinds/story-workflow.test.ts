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
import { beforeAll, describe, expect, test, vi } from "vitest";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { storyActivityWorkflow } from "./story-workflow";

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
    title: "The night the labels got swapped",
  },
}));

vi.mock("@zoonk/ai/tasks/activities/core/story-steps", () => ({
  generateActivityStorySteps: vi.fn().mockResolvedValue({ data: mockStorySteps }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/story-debrief", () => ({
  generateActivityStoryDebrief: vi.fn().mockResolvedValue({ data: mockDebriefData }),
}));

describe("story activity workflow", () => {
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
      title: `Story WF Chapter ${randomUUID()}`,
    });
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

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });

    await storyActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: storyActivity.id },
    });

    // 1 intro + 2 decision steps + 1 outcome + 2 debrief concepts = 6
    expect(steps).toHaveLength(6);

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

    // Debrief concepts: individual text steps
    expect(steps[4]?.kind).toBe("static");
    expect(steps[4]?.position).toBe(4);
    expect(getString(steps[4]?.content, "variant")).toBe("text");
    expect(getString(steps[4]?.content, "title")).toBe("Crisis Communication");

    expect(steps[5]?.kind).toBe("static");
    expect(steps[5]?.position).toBe(5);
    expect(getString(steps[5]?.content, "variant")).toBe("text");
    expect(getString(steps[5]?.content, "title")).toBe("Supply Chain Resilience");

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

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });

    await storyActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: storyActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
    expect(dbActivity?.title).toBe(mockStorySteps.title);
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

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });

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

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });

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

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });

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
