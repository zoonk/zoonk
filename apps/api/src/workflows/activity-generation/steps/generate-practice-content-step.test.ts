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
import { generatePracticeContentStep } from "./generate-practice-content-step";

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

const { generateActivityPracticeMock } = vi.hoisted(() => ({
  generateActivityPracticeMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/practice", () => ({
  generateActivityPractice: generateActivityPracticeMock,
}));

describe(generatePracticeContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Practice Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns practice steps for a practice activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Practice Content ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const practiceSteps = [
      {
        context: "Context 1",
        options: [
          { feedback: "Correct!", isCorrect: true, text: "A" },
          { feedback: "Wrong", isCorrect: false, text: "B" },
        ],
        question: "Question 1",
      },
    ];

    generateActivityPracticeMock.mockResolvedValue({ data: { steps: practiceSteps } });

    const explanationSteps = [{ text: "Explanation text", title: "Explanation title" }];

    const result = await generatePracticeContentStep(activities, explanationSteps, "run-1");

    expect(result.activityId).toBe(activities.find((a) => a.kind === "practice")?.id);
    expect(result.steps).toEqual(practiceSteps);
  });

  test("returns null activityId when no practice activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Practice None ${randomUUID()}`,
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

    const result = await generatePracticeContentStep(
      activities,
      [{ text: "text", title: "title" }],
      "run-2",
    );

    expect(result).toEqual({ activityId: null, steps: [] });
    expect(generateActivityPracticeMock).not.toHaveBeenCalled();
  });

  test("marks activity as failed when explanation steps are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Practice Empty Explanation ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generatePracticeContentStep(activities, [], "run-3");

    expect(result).toEqual({ activityId: null, steps: [] });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("marks activity as failed when AI returns empty steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Practice AI Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityPracticeMock.mockResolvedValue({ data: { steps: [] } });

    const result = await generatePracticeContentStep(
      activities,
      [{ text: "text", title: "title" }],
      "run-4",
    );

    expect(result).toEqual({ activityId: null, steps: [] });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Practice Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const practiceActivity = activities.find((a) => a.kind === "practice")!;

    generateActivityPracticeMock.mockResolvedValue({
      data: {
        steps: [
          {
            context: "ctx",
            options: [{ feedback: "f", isCorrect: true, text: "t" }],
            question: "q",
          },
        ],
      },
    });

    await generatePracticeContentStep(activities, [{ text: "text", title: "title" }], "run-5");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: practiceActivity.id,
        status: "started",
        step: "generatePracticeContent",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: practiceActivity.id,
        status: "completed",
        step: "generatePracticeContent",
      }),
    );
  });

  test("marks activity as failed and streams error when AI call fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Practice AI Error ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "practice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const practiceActivity = activities.find((a) => a.kind === "practice")!;

    generateActivityPracticeMock.mockRejectedValue(new Error("AI failed"));

    const result = await generatePracticeContentStep(
      activities,
      [{ text: "text", title: "title" }],
      "run-6",
    );

    expect(result).toEqual({ activityId: null, steps: [] });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: practiceActivity.id,
        status: "error",
        step: "generatePracticeContent",
      }),
    );
  });
});
