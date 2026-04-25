import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateStoryChoicesStep } from "./generate-story-choices-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

const { buildActivityStoryWithChoicesMock, generateActivityStoryChoicesMock } = vi.hoisted(() => ({
  buildActivityStoryWithChoicesMock: vi.fn(),
  generateActivityStoryChoicesMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/story-choices", () => ({
  buildActivityStoryWithChoices: buildActivityStoryWithChoicesMock,
  generateActivityStoryChoices: generateActivityStoryChoicesMock,
}));

const mockStoryPlan = {
  intro: "You are a factory manager.",
  introImagePrompt: "Factory floor at sunrise with workers waiting for direction",
  metrics: ["Production", "Morale"],
  outcomes: {
    bad: {
      imagePrompt: "Factory floor split between partial progress and lingering confusion",
      narrative: "Some fixes landed, but the operation still feels uneven.",
      title: "Uneven day",
    },
    good: {
      imagePrompt: "Factory floor working again with a few visible bottlenecks",
      narrative: "The line is moving again, but the team still feels the strain.",
      title: "Mostly steady",
    },
    ok: {
      imagePrompt: "Factory floor partly stable with workers still clearing bottlenecks",
      narrative: "You kept the line alive, but the recovery still needs attention.",
      title: "Partial recovery",
    },
    perfect: {
      imagePrompt: "Recovered factory floor with steady output and calmer workers",
      narrative: "You stabilized the factory and restored confidence.",
      title: "Back on track",
    },
    terrible: {
      imagePrompt: "Factory floor stalled again with tired workers and missing parts",
      narrative: "The crisis kept spreading faster than your decisions could contain it.",
      title: "Still unraveling",
    },
  },
  steps: [
    {
      imagePrompt: "Factory floor with halted lines and workers looking worried",
      problem: "Your supplier went bankrupt.",
    },
  ],
  title: "The night the labels got swapped",
};

const mockStoryChoices = {
  steps: [
    {
      choices: [
        {
          alignment: "strong",
          consequence: "Workers rally.",
          label: "Address the team",
          metricEffects: [{ effect: "positive", metric: "Morale" }],
          stateImagePrompt:
            "Factory floor after the leader addresses the team and confidence returns",
        },
        {
          alignment: "weak",
          consequence: "Rumors spread.",
          label: "Send an email",
          metricEffects: [{ effect: "negative", metric: "Morale" }],
          stateImagePrompt: "Factory floor after a vague email leaves workers confused",
        },
      ],
    },
  ],
};

const mockStoryData = {
  ...mockStoryPlan,
  steps: [
    {
      ...mockStoryPlan.steps[0],
      choices: mockStoryChoices.steps[0]!.choices,
    },
  ],
};

describe(generateStoryChoicesStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Story Choices Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    generateActivityStoryChoicesMock.mockResolvedValue({ data: mockStoryChoices });
    buildActivityStoryWithChoicesMock.mockReturnValue(mockStoryData);
  });

  test("returns merged story data after generating choices", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Supply Chain", "Communication"],
      organizationId,
      title: `Story Choices ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const storyActivity = activities.find((activity) => activity.kind === "story")!;
    const explanationSteps = [{ text: "Supply chains need backup paths.", title: "Backup paths" }];

    const result = await generateStoryChoicesStep({
      activity: storyActivity,
      explanationSteps,
      storyPlan: mockStoryPlan,
    });

    expect(result).toEqual(mockStoryData);
    expect(generateActivityStoryChoicesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        concepts: ["Supply Chain", "Communication"],
        explanationSteps,
        language: "en",
        storyPlan: mockStoryPlan,
        topic: lesson.title,
      }),
    );
    expect(buildActivityStoryWithChoicesMock).toHaveBeenCalledWith({
      choices: mockStoryChoices,
      storyPlan: mockStoryPlan,
    });
  });

  test("throws when choice generation returns no result", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Story Choices Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const storyActivity = activities.find((activity) => activity.kind === "story")!;

    generateActivityStoryChoicesMock.mockResolvedValue(null);

    await expect(
      generateStoryChoicesStep({
        activity: storyActivity,
        explanationSteps: [{ text: "Explanation content.", title: "Explanation" }],
        storyPlan: mockStoryPlan,
      }),
    ).rejects.toThrow("aiEmptyResult");

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("pending");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "error",
        step: "generateStoryChoices",
      }),
    );
  });
});
