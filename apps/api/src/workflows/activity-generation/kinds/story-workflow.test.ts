import { randomUUID } from "node:crypto";
import { generateActivityStory } from "@zoonk/ai/tasks/activities/core/story";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
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

vi.mock("@zoonk/ai/tasks/activities/core/story", () => ({
  generateActivityStory: vi.fn().mockResolvedValue({
    data: {
      steps: [
        {
          context: "Your colleague turns to you during a meeting...",
          options: [
            { feedback: "Great choice!", isCorrect: true, text: "Option A" },
            { feedback: "Not quite.", isCorrect: false, text: "Option B" },
            { feedback: "Try again.", isCorrect: false, text: "Option C" },
            { feedback: "Nope.", isCorrect: false, text: "Option D" },
          ],
          question: "What should you do?",
        },
      ],
    },
  }),
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

  test("creates story steps with multipleChoice kind", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Story Content Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await storyActivityWorkflow(activities, "test-run-id", concepts, []);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(1);
    expect(steps[0]?.isPublished).toBeTruthy();
    expect(steps[0]?.kind).toBe("multipleChoice");
    expect(steps[0]?.content).toEqual({
      context: "Your colleague turns to you during a meeting...",
      kind: "core",
      options: [
        { feedback: "Great choice!", isCorrect: true, text: "Option A" },
        { feedback: "Not quite.", isCorrect: false, text: "Option B" },
        { feedback: "Try again.", isCorrect: false, text: "Option C" },
        { feedback: "Nope.", isCorrect: false, text: "Option D" },
      ],
      question: "What should you do?",
    });
  });

  test("sets story status to 'completed' after saving", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Story Completed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await storyActivityWorkflow(activities, "test-run-id", concepts, []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("sets story status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityStory).mockRejectedValueOnce(new Error("Story generation failed"));

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Story Failed Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await storyActivityWorkflow(activities, "test-run-id", concepts, []);

    const dbActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("sets story status to 'failed' when concepts are empty", async () => {
    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: [],
      organizationId,
      title: `Story No Concepts Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);

    await storyActivityWorkflow(activities, "test-run-id", [], []);

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
      title: `Story Skip Lesson ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      kind: "story",
      lessonId: testLesson.id,
      organizationId,
      title: `Story ${randomUUID()}`,
    });

    await stepFixture({
      activityId: activity.id,
      content: {
        context: "Existing context",
        kind: "core",
        options: [{ feedback: "Yes", isCorrect: true, text: "A" }],
        question: "Existing?",
      },
      kind: "multipleChoice",
      position: 0,
    });

    const activities = await getLessonActivitiesStep(testLesson.id);
    const concepts = activities[0]?.lesson?.concepts ?? [];

    await storyActivityWorkflow(activities, "test-run-id", concepts, []);

    expect(generateActivityStory).not.toHaveBeenCalled();
  });
});
