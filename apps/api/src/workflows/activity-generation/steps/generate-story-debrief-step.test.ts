import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateStoryDebriefStep } from "./generate-story-debrief-step";

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

const { generateActivityStoryDebriefMock } = vi.hoisted(() => ({
  generateActivityStoryDebriefMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/story-debrief", () => ({
  generateActivityStoryDebrief: generateActivityStoryDebriefMock,
}));

const mockStorySteps = {
  intro: "You are a factory manager.",
  metrics: ["Production", "Morale"],
  steps: [
    {
      choices: [
        {
          alignment: "strong" as const,
          consequence: "Workers rally.",
          id: "c1",
          metricEffects: [{ effect: "positive" as const, metric: "Morale" }],
          text: "Address the team",
        },
      ],
      situation: "Your supplier went bankrupt.",
    },
  ],
};

const mockDebriefData = {
  debrief: [{ explanation: "Communication matters.", name: "Crisis Communication" }],
  outcomes: [
    { minStrongChoices: 1, narrative: "Well done.", title: "Great" },
    { minStrongChoices: 0, narrative: "Needs work.", title: "Okay" },
  ],
};

describe(generateStoryDebriefStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Debrief Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns debrief data from story steps output", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Debrief Content ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityStoryDebriefMock.mockResolvedValue({ data: mockDebriefData });

    const result = await generateStoryDebriefStep({
      activitiesToGenerate: activities,
      activityId: Number(storyActivity.id),
      storySteps: mockStorySteps,
    });

    expect(result).toEqual(mockDebriefData);

    expect(generateActivityStoryDebriefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "en",
        storySteps: mockStorySteps,
        topic: lesson.title,
      }),
    );
  });

  test("returns null when no story activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Debrief None ${randomUUID()}`,
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

    const result = await generateStoryDebriefStep({
      activitiesToGenerate: activities,
      activityId: 999,
      storySteps: mockStorySteps,
    });

    expect(result).toBeNull();
    expect(generateActivityStoryDebriefMock).not.toHaveBeenCalled();
  });

  test("marks activity as failed when AI returns empty outcomes", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Debrief Empty ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityStoryDebriefMock.mockResolvedValue({
      data: { debrief: [{ explanation: "x", name: "x" }], outcomes: [] },
    });

    const result = await generateStoryDebriefStep({
      activitiesToGenerate: activities,
      activityId: Number(storyActivity.id),
      storySteps: mockStorySteps,
    });

    expect(result).toBeNull();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: storyActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("marks activity as failed when AI call throws", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Debrief AI Error ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityStoryDebriefMock.mockRejectedValue(new Error("Debrief failed"));

    const result = await generateStoryDebriefStep({
      activitiesToGenerate: activities,
      activityId: Number(storyActivity.id),
      storySteps: mockStorySteps,
    });

    expect(result).toBeNull();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: storyActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Debrief Stream ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityStoryDebriefMock.mockResolvedValue({ data: mockDebriefData });

    await generateStoryDebriefStep({
      activitiesToGenerate: activities,
      activityId: Number(storyActivity.id),
      storySteps: mockStorySteps,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(storyActivity.id),
        status: "started",
        step: "generateStoryDebrief",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(storyActivity.id),
        status: "completed",
        step: "generateStoryDebrief",
      }),
    );
  });

  test("streams error event when AI call fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Debrief Stream Error ${randomUUID()}`,
    });

    const storyActivity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityStoryDebriefMock.mockRejectedValue(new Error("AI failed"));

    await generateStoryDebriefStep({
      activitiesToGenerate: activities,
      activityId: Number(storyActivity.id),
      storySteps: mockStorySteps,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(storyActivity.id),
        status: "error",
        step: "generateStoryDebrief",
      }),
    );
  });
});
