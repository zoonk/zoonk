import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { type QuizQuestion } from "@zoonk/ai/tasks/activities/core/quiz";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveQuizActivityStep } from "./save-quiz-activity-step";

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

describe(saveQuizActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Quiz Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves quiz steps from multipleChoice questions and marks activity as completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Quiz ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz ${randomUUID()}`,
    });

    const questions: QuizQuestion[] = [
      {
        context: "Context for quiz question 1",
        format: "multipleChoice",
        options: [
          { feedback: "Correct!", isCorrect: true, text: "Option A" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option B" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option C" },
        ],
        question: `Quiz question 1? ${randomUUID()}`,
      },
      {
        context: "Context for quiz question 2",
        format: "multipleChoice",
        options: [
          { feedback: "Incorrect.", isCorrect: false, text: "Option A" },
          { feedback: "Correct!", isCorrect: true, text: "Option B" },
        ],
        question: `Quiz question 2? ${randomUUID()}`,
      },
    ];

    await saveQuizActivityStep({
      activityId: Number(activity.id),
      questions,
      workflowRunId: "workflow-1",
    });

    const [dbSteps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: activity.id },
      }),
    ]);

    expect(dbSteps).toHaveLength(2);

    expect(dbSteps.map((step) => [step.position, step.kind])).toEqual([
      [0, "multipleChoice"],
      [1, "multipleChoice"],
    ]);

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveQuizActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveQuizActivity" }),
    );
  });

  test("streams error when DB transaction fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Quiz Error ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "quiz",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Quiz Fail ${randomUUID()}`,
    });

    // Delete the activity so the prisma.activity.update inside the transaction fails
    await prisma.activity.delete({ where: { id: activity.id } });

    const questions: QuizQuestion[] = [
      {
        context: "Context",
        format: "multipleChoice",
        options: [
          { feedback: "Correct!", isCorrect: true, text: "Option A" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option B" },
        ],
        question: "What is the answer?",
      },
    ];

    await saveQuizActivityStep({
      activityId: Number(activity.id),
      questions,
      workflowRunId: "workflow-error",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveQuizActivity" }),
    );
  });
});
