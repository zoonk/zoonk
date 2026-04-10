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
import { generateQuizContentStep } from "./generate-quiz-content-step";

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

const { generateActivityQuizMock } = vi.hoisted(() => ({
  generateActivityQuizMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/quiz", () => ({
  generateActivityQuiz: generateActivityQuizMock,
}));

describe(generateQuizContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Quiz Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns quiz questions for a quiz activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Content ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const questions = [
      {
        format: "selectOne",
        options: [
          { feedback: "Correct!", isCorrect: true, text: "A" },
          { feedback: "Wrong", isCorrect: false, text: "B" },
        ],
        question: "What is correct?",
      },
    ];

    generateActivityQuizMock.mockResolvedValue({ data: { questions } });

    const explanationSteps = [{ text: "Explanation text", title: "Explanation title" }];

    const result = await generateQuizContentStep(activities, explanationSteps, "run-1");

    expect(result.activityId).toBe(activities.find((a) => a.kind === "quiz")?.id);
    expect(result.questions).toEqual(questions);
  });

  test("returns null activityId when no quiz activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz None ${randomUUID()}`,
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

    const result = await generateQuizContentStep(
      activities,
      [{ text: "text", title: "title" }],
      "run-2",
    );

    expect(result).toEqual({ activityId: null, questions: [] });
    expect(generateActivityQuizMock).not.toHaveBeenCalled();
  });

  test("marks activity as failed when explanation steps are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Empty Explanation ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generateQuizContentStep(activities, [], "run-3");

    expect(result).toEqual({ activityId: null, questions: [] });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("marks activity as failed when AI returns empty questions", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz AI Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityQuizMock.mockResolvedValue({ data: { questions: [] } });

    const result = await generateQuizContentStep(
      activities,
      [{ text: "text", title: "title" }],
      "run-4",
    );

    expect(result).toEqual({ activityId: null, questions: [] });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const quizActivity = activities.find((a) => a.kind === "quiz")!;

    generateActivityQuizMock.mockResolvedValue({
      data: {
        questions: [
          {
            format: "selectOne",
            options: [{ feedback: "f", isCorrect: true, text: "t" }],
            question: "q",
          },
        ],
      },
    });

    await generateQuizContentStep(activities, [{ text: "text", title: "title" }], "run-5");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: quizActivity.id,
        status: "started",
        step: "generateQuizContent",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: quizActivity.id,
        status: "completed",
        step: "generateQuizContent",
      }),
    );
  });

  test("marks activity as failed and streams error when AI call fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Quiz AI Error ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const quizActivity = activities.find((a) => a.kind === "quiz")!;

    generateActivityQuizMock.mockRejectedValue(new Error("AI failed"));

    const result = await generateQuizContentStep(
      activities,
      [{ text: "text", title: "title" }],
      "run-6",
    );

    expect(result).toEqual({ activityId: null, questions: [] });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: quizActivity.id,
        status: "error",
        step: "generateQuizContent",
      }),
    );
  });
});
