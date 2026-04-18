import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type PracticeStep } from "./generate-practice-content-step";
import { savePracticeActivityStep } from "./save-practice-activity-step";

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

const practiceScenario = {
  text: "I'm closing the support queue with Maya, and one customer report still does not line up with the refund totals.",
  title: "Night shift",
};

describe(savePracticeActivityStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Practice Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves multipleChoice steps and marks activity as completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Practice ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: null,
    });

    const steps: PracticeStep[] = [
      {
        context: "Context for question 1",
        options: [
          { feedback: "Correct!", isCorrect: true, text: "Option A" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option B" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option C" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option D" },
        ],
        question: `What is the answer? ${randomUUID()}`,
      },
      {
        context: "Context for question 2",
        options: [
          { feedback: "Incorrect.", isCorrect: false, text: "Option A" },
          { feedback: "Correct!", isCorrect: true, text: "Option B" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option C" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option D" },
        ],
        question: `What is the second answer? ${randomUUID()}`,
      },
    ];

    await savePracticeActivityStep({
      activityId: activity.id,
      scenario: practiceScenario,
      steps,
      title: "The game store signup mix-up",
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

    expect(dbSteps).toHaveLength(3);

    expect(dbSteps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "multipleChoice"],
      [2, "multipleChoice"],
    ]);

    expect(dbSteps[0]?.content).toEqual({
      text: practiceScenario.text,
      title: practiceScenario.title,
      variant: "text",
    });

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
      title: "The game store signup mix-up",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "savePracticeActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "savePracticeActivity" }),
    );
  });

  test("streams error when DB transaction fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Practice Error ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Practice Fail ${randomUUID()}`,
    });

    // Delete the activity so the prisma.activity.update inside the transaction fails
    await prisma.activity.delete({ where: { id: activity.id } });

    const steps: PracticeStep[] = [
      {
        context: "Context",
        options: [
          { feedback: "Correct!", isCorrect: true, text: "Option A" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option B" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option C" },
          { feedback: "Incorrect.", isCorrect: false, text: "Option D" },
        ],
        question: "What is the answer?",
      },
    ];

    await savePracticeActivityStep({
      activityId: activity.id,
      scenario: practiceScenario,
      steps,
      title: "The game store signup mix-up",
      workflowRunId: "workflow-error",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "savePracticeActivity" }),
    );
  });
});
