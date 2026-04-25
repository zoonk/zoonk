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

const { generateActivityStoryMock } = vi.hoisted(() => ({ generateActivityStoryMock: vi.fn() }));

vi.mock("@zoonk/ai/tasks/activities/core/story", () => ({
  generateActivityStory: generateActivityStoryMock,
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

  test("returns story plan data for a story activity", async () => {
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

    generateActivityStoryMock.mockResolvedValue({ data: mockStoryPlan });

    const result = await generateStoryContentStep(activities, [
      { text: "Supply chains need backup paths.", title: "Backup paths" },
    ]);

    expect(result.activityId).toBe(activities.find((a) => a.kind === "story")?.id);
    expect(result.storyPlan).toEqual(mockStoryPlan);
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

    generateActivityStoryMock.mockResolvedValue({ data: mockStoryPlan });

    const explanationSteps = [
      { text: "First explanation step.", title: "First" },
      { text: "Second explanation step.", title: "Second" },
    ];

    await generateStoryContentStep(activities, explanationSteps);

    expect(generateActivityStoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        concepts: ["Concept A", "Concept B"],
        explanationSteps,
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

    const result = await generateStoryContentStep(activities, [
      { text: "Explanation content.", title: "Explanation" },
    ]);

    expect(result).toEqual({ activityId: null, storyPlan: null });
    expect(generateActivityStoryMock).not.toHaveBeenCalled();
  });

  test("throws when explanation steps are missing", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Story Missing Explanation ${randomUUID()}`,
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

    await expect(generateStoryContentStep(activities, [])).rejects.toThrow(
      "Story generation needs explanation steps",
    );
    expect(generateActivityStoryMock).not.toHaveBeenCalled();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("pending");
  });

  test("throws when AI returns no result", async () => {
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

    generateActivityStoryMock.mockResolvedValue(null);

    await expect(
      generateStoryContentStep(activities, [
        { text: "Explanation content.", title: "Explanation" },
      ]),
    ).rejects.toThrow("aiEmptyResult");

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("pending");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "error",
        step: "generateStoryContent",
      }),
    );
  });

  test("throws AI errors without streaming an error status", async () => {
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

    generateActivityStoryMock.mockRejectedValue(new Error("AI failed"));

    await expect(
      generateStoryContentStep(activities, [
        { text: "Explanation content.", title: "Explanation" },
      ]),
    ).rejects.toThrow("AI failed");

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("pending");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
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

    generateActivityStoryMock.mockResolvedValue({ data: mockStoryPlan });

    await generateStoryContentStep(activities, [
      { text: "Explanation content.", title: "Explanation" },
    ]);

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
