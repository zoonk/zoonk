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
import { generateStoryContentStep } from "./generate-story-content-step";

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

const { generateActivityStoryStepsMock } = vi.hoisted(() => ({
  generateActivityStoryStepsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/story-steps", () => ({
  generateActivityStorySteps: generateActivityStoryStepsMock,
}));

const mockStoryData = {
  intro: "You are a factory manager.",
  metrics: ["Production", "Morale"],
  steps: [
    {
      choices: [
        {
          alignment: "strong",
          consequence: "Workers rally.",
          id: "c1",
          metricEffects: [{ effect: "positive", metric: "Morale" }],
          text: "Address the team",
        },
        {
          alignment: "weak",
          consequence: "Rumors spread.",
          id: "c2",
          metricEffects: [{ effect: "negative", metric: "Morale" }],
          text: "Send an email",
        },
      ],
      situation: "Your supplier went bankrupt.",
    },
  ],
  title: "The night the labels got swapped",
};

describe(generateStoryContentStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Story Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns story steps data for a story activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Supply Chain", "Communication"],
      organizationId,
      title: `Story Content ${randomUUID()}`,
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

    generateActivityStoryStepsMock.mockResolvedValue({ data: mockStoryData });

    const result = await generateStoryContentStep(activities);

    expect(result.activityId).toBe(activities.find((a) => a.kind === "story")?.id);
    expect(result.storySteps).toEqual(mockStoryData);
    expect(result.title).toBe("The night the labels got swapped");
  });

  test("passes lesson concepts and context to the AI task", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept A", "Concept B"],
      organizationId,
      title: `Story Concepts ${randomUUID()}`,
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

    generateActivityStoryStepsMock.mockResolvedValue({ data: mockStoryData });

    await generateStoryContentStep(activities);

    expect(generateActivityStoryStepsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        concepts: ["Concept A", "Concept B"],
        language: "en",
        topic: lesson.title,
      }),
    );
  });

  test("returns null activityId when no story activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Story None ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generateStoryContentStep(activities);

    expect(result).toEqual({ activityId: null, storySteps: null, title: null });
    expect(generateActivityStoryStepsMock).not.toHaveBeenCalled();
  });

  test("marks activity as failed when AI returns empty steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Story AI Empty ${randomUUID()}`,
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

    generateActivityStoryStepsMock.mockResolvedValue({
      data: {
        intro: "Intro",
        metrics: ["M"],
        steps: [],
        title: "The night the labels got swapped",
      },
    });

    const result = await generateStoryContentStep(activities);

    expect(result).toEqual({ activityId: null, storySteps: null, title: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "error",
        step: "generateStoryContent",
      }),
    );
  });

  test("marks activity as failed and streams error when AI call throws", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Story AI Error ${randomUUID()}`,
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

    generateActivityStoryStepsMock.mockRejectedValue(new Error("AI failed"));

    const result = await generateStoryContentStep(activities);

    expect(result).toEqual({ activityId: null, storySteps: null, title: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "error",
        step: "generateStoryContent",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Story Stream ${randomUUID()}`,
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
    const storyActivity = activities.find((a) => a.kind === "story")!;

    generateActivityStoryStepsMock.mockResolvedValue({ data: mockStoryData });

    await generateStoryContentStep(activities);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: storyActivity.id,
        status: "started",
        step: "generateStoryContent",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: storyActivity.id,
        status: "completed",
        step: "generateStoryContent",
      }),
    );
  });
});
