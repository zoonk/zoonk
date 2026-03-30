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
import { generateTradeoffContentStep } from "./generate-tradeoff-content-step";

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

const { generateActivityTradeoffMock } = vi.hoisted(() => ({
  generateActivityTradeoffMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/tradeoff", () => ({
  generateActivityTradeoff: generateActivityTradeoffMock,
}));

function makeTradeoffAIOutput() {
  return {
    priorities: [
      { description: "Study notes", id: "study", name: "Study" },
      { description: "Exercise", id: "exercise", name: "Exercise" },
      { description: "Sleep", id: "sleep", name: "Sleep" },
    ],
    reflection: { text: "Reflection text", title: "Reflection" },
    resource: { name: "hours", total: 5 },
    rounds: [
      {
        event: null,
        outcomes: [
          {
            invested: { consequence: "Good" },
            maintained: { consequence: "OK" },
            neglected: { consequence: "Bad" },
            priorityId: "study",
          },
        ],
        stateModifiers: null,
        tokenOverride: null,
      },
      {
        event: "Event happened",
        outcomes: [
          {
            invested: { consequence: "Great" },
            maintained: { consequence: "Fine" },
            neglected: { consequence: "Worse" },
            priorityId: "study",
          },
        ],
        stateModifiers: [{ delta: -1, priorityId: "sleep" }],
        tokenOverride: 4,
      },
    ],
    scenario: { text: "Scenario text", title: "Scenario" },
  };
}

describe(generateTradeoffContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Tradeoff Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns tradeoff content for a tradeoff activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Tradeoff Content ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "tradeoff",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Tradeoff ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const aiOutput = makeTradeoffAIOutput();

    generateActivityTradeoffMock.mockResolvedValue({ data: aiOutput });

    const explanationSteps = [{ text: "Explanation text", title: "Explanation title" }];

    const result = await generateTradeoffContentStep(activities, explanationSteps, "run-1");

    expect(result.activityId).toBe(activities.find((act) => act.kind === "tradeoff")?.id);
    expect(result.content).toEqual(aiOutput);
  });

  test("returns null when no tradeoff activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Tradeoff None ${randomUUID()}`,
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

    const result = await generateTradeoffContentStep(
      activities,
      [{ text: "text", title: "title" }],
      "run-2",
    );

    expect(result).toEqual({ activityId: null, content: null });
    expect(generateActivityTradeoffMock).not.toHaveBeenCalled();
  });

  test("marks activity as failed when explanation steps are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Tradeoff Empty Explanation ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "tradeoff",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Tradeoff ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generateTradeoffContentStep(activities, [], "run-3");

    expect(result).toEqual({ activityId: null, content: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("marks activity as failed when AI returns empty rounds", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Tradeoff AI Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "tradeoff",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Tradeoff ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityTradeoffMock.mockResolvedValue({
      data: { ...makeTradeoffAIOutput(), rounds: [] },
    });

    const result = await generateTradeoffContentStep(
      activities,
      [{ text: "text", title: "title" }],
      "run-4",
    );

    expect(result).toEqual({ activityId: null, content: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Tradeoff Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "tradeoff",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Tradeoff ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const tradeoffActivity = activities.find((act) => act.kind === "tradeoff");

    generateActivityTradeoffMock.mockResolvedValue({ data: makeTradeoffAIOutput() });

    await generateTradeoffContentStep(activities, [{ text: "text", title: "title" }], "run-5");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: tradeoffActivity?.id,
        status: "started",
        step: "generateTradeoffContent",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: tradeoffActivity?.id,
        status: "completed",
        step: "generateTradeoffContent",
      }),
    );
  });

  test("streams error event when AI call fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Tradeoff AI Error ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "tradeoff",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Tradeoff ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityTradeoffMock.mockRejectedValue(new Error("AI failed"));

    await generateTradeoffContentStep(activities, [{ text: "text", title: "title" }], "run-6");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        status: "error",
        step: "generateTradeoffContent",
      }),
    );
  });
});
