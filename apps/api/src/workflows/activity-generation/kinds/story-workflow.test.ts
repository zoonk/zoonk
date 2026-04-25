import { randomUUID } from "node:crypto";
import { generateActivityStory } from "@zoonk/ai/tasks/activities/core/story";
import { generateActivityStoryChoices } from "@zoonk/ai/tasks/activities/core/story-choices";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { getString } from "@zoonk/utils/json";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateStoryImagesStep } from "../steps/generate-story-images-step";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { storyActivityWorkflow } from "./story-workflow";

const { mockStoryChoices, mockStoryData, mockStoryImages, mockStoryPlan } = vi.hoisted(() => {
  const storyPlan = {
    intro: "You are a factory manager facing a supply chain crisis.",
    introImagePrompt: "Factory floor with anxious workers waiting for direction",
    metrics: ["Production", "Morale", "Cash"],
    outcomes: {
      bad: {
        imagePrompt: "Factory floor mixed between progress and lingering strain",
        narrative: "You fixed part of the system, but the team still feels the pressure.",
        title: "Mixed",
      },
      good: {
        imagePrompt: "Factory floor stabilizing with some strain still visible",
        narrative: "You navigated the crisis with only minor rough edges left.",
        title: "Good",
      },
      ok: {
        imagePrompt: "Factory floor moving again while supervisors still watch bottlenecks",
        narrative: "You avoided collapse, but the operation still feels fragile.",
        title: "Uneven recovery",
      },
      perfect: {
        imagePrompt: "Recovered factory floor with confident workers and steady output",
        narrative: "You turned crisis into opportunity.",
        title: "Excellent",
      },
      terrible: {
        imagePrompt: "Factory floor still overwhelmed with frustrated workers and empty bins",
        narrative: "The crisis overwhelmed you.",
        title: "Needs work",
      },
    },
    steps: [
      {
        imagePrompt: "Factory floor with halted lines and empty parts bins",
        problem: "Your main supplier just went bankrupt.",
      },
      {
        imagePrompt: "Production area paused while engineers debate how to proceed without parts",
        problem: "Production is halted without parts.",
      },
    ],
    title: "The night the labels got swapped",
  };
  const storyChoices = {
    steps: [
      {
        choices: [
          {
            alignment: "strong",
            consequence: "Workers rally behind you.",
            label: "Address the team directly",
            metricEffects: [{ effect: "positive", metric: "Morale" }],
            stateImagePrompt: "Factory floor after a direct address calms the team",
          },
          {
            alignment: "weak",
            consequence: "Rumors spread unchecked.",
            label: "Send an email instead",
            metricEffects: [{ effect: "negative", metric: "Morale" }],
            stateImagePrompt: "Factory floor after a vague email leaves workers confused",
          },
        ],
      },
      {
        choices: [
          {
            alignment: "partial",
            consequence: "You find a reasonable alternative.",
            label: "Contact backup suppliers",
            metricEffects: [{ effect: "positive", metric: "Production" }],
            stateImagePrompt: "Temporary supply shipment arriving at the factory loading dock",
          },
          {
            alignment: "strong",
            consequence: "Innovation emerges from constraint.",
            label: "Redesign the product to use different materials",
            metricEffects: [
              { effect: "positive", metric: "Production" },
              { effect: "positive", metric: "Cash" },
            ],
            stateImagePrompt:
              "Factory team adapting the product with new materials and renewed momentum",
          },
        ],
      },
    ],
  };
  const storyData = {
    ...storyPlan,
    steps: storyPlan.steps.map((step, index) => ({
      ...step,
      choices: storyChoices.steps[index]!.choices,
    })),
  };

  return {
    mockStoryChoices: storyChoices,
    mockStoryData: storyData,
    mockStoryImages: {
      choiceStateImages: [
        [
          { prompt: "State 1A", url: "https://example.com/state-1a.webp" },
          { prompt: "State 1B", url: "https://example.com/state-1b.webp" },
        ],
        [
          { prompt: "State 2A", url: "https://example.com/state-2a.webp" },
          { prompt: "State 2B", url: "https://example.com/state-2b.webp" },
        ],
      ],
      introImage: {
        prompt: "Story intro",
        url: "https://example.com/story-intro.webp",
      },
      outcomeImages: {
        bad: { prompt: "Outcome bad", url: "https://example.com/outcome-bad.webp" },
        good: { prompt: "Outcome good", url: "https://example.com/outcome-good.webp" },
        ok: { prompt: "Outcome ok", url: "https://example.com/outcome-ok.webp" },
        perfect: { prompt: "Outcome perfect", url: "https://example.com/outcome-perfect.webp" },
        terrible: { prompt: "Outcome terrible", url: "https://example.com/outcome-terrible.webp" },
      },
      stepImages: [
        { prompt: "Story step 1", url: "https://example.com/step-1.webp" },
        { prompt: "Story step 2", url: "https://example.com/step-2.webp" },
      ],
    },
    mockStoryPlan: storyPlan,
  };
});

vi.mock("@zoonk/ai/tasks/activities/core/story", () => ({
  generateActivityStory: vi.fn().mockResolvedValue({ data: mockStoryPlan }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/story-choices", () => ({
  buildActivityStoryWithChoices: vi.fn().mockReturnValue(mockStoryData),
  generateActivityStoryChoices: vi.fn().mockResolvedValue({ data: mockStoryChoices }),
}));

vi.mock("../steps/generate-story-images-step", () => ({
  generateStoryImagesStep: vi.fn().mockResolvedValue(mockStoryImages),
}));

const storyExplanationSteps = [
  { text: "A useful explanation for the story activity.", title: "Story context" },
];

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates story steps with intro, decisions, and outcome", async () => {
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
      explanationSteps: storyExplanationSteps,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: storyActivity.id },
    });

    expect(steps).toHaveLength(4);
    expect(steps[0]?.kind).toBe("static");
    expect(steps[0]?.position).toBe(0);
    expect(getString(steps[0]?.content, "variant")).toBe("intro");
    expect(getString(steps[0]?.content, "title")).toBe(mockStoryData.title);
    expect(steps[1]?.kind).toBe("story");
    expect(steps[1]?.position).toBe(1);
    expect(steps[2]?.kind).toBe("story");
    expect(steps[2]?.position).toBe(2);
    expect(steps[3]?.kind).toBe("static");
    expect(steps[3]?.position).toBe(3);
    expect(getString(steps[3]?.content, "variant")).toBe("storyOutcome");

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
      explanationSteps: storyExplanationSteps,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({
      where: { id: storyActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
    expect(dbActivity?.title).toBe(mockStoryData.title);
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
      explanationSteps: storyExplanationSteps,
      workflowRunId: "test-run-id",
    });

    expect(generateActivityStory).not.toHaveBeenCalled();
    expect(generateActivityStoryChoices).not.toHaveBeenCalled();
  });

  test("marks story as failed when content generation throws", async () => {
    vi.mocked(generateActivityStory).mockRejectedValueOnce(new Error("AI failed"));

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

    await expect(
      storyActivityWorkflow({
        activitiesToGenerate: activities,
        explanationSteps: storyExplanationSteps,
        workflowRunId: "test-run-id",
      }),
    ).rejects.toThrow("AI failed");

    const dbActivity = await prisma.activity.findUnique({
      where: { id: storyActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivityStoryChoices).not.toHaveBeenCalled();
  });

  test("marks story as failed when image generation throws", async () => {
    vi.mocked(generateStoryImagesStep).mockRejectedValueOnce(new Error("Images failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Story Images Fail ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep({ lessonId: testLesson.id });

    await expect(
      storyActivityWorkflow({
        activitiesToGenerate: activities,
        explanationSteps: storyExplanationSteps,
        workflowRunId: "test-run-id",
      }),
    ).rejects.toThrow("Images failed");

    const dbActivity = await prisma.activity.findUnique({
      where: { id: storyActivity.id },
    });

    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivityStory).toHaveBeenCalled();
    expect(generateActivityStoryChoices).toHaveBeenCalled();
  });
});
