import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { type ActivityTradeoffSchema } from "@zoonk/ai/tasks/activities/core/tradeoff";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveTradeoffActivityStep } from "./save-tradeoff-activity-step";

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

function makeTradeoffContent(): ActivityTradeoffSchema {
  return {
    priorities: [
      { description: "Study notes", id: "study", name: "Study" },
      { description: "Physical activity", id: "exercise", name: "Exercise" },
      { description: "Rest", id: "sleep", name: "Sleep" },
    ],
    reflection: {
      text: "Learning happens in three stages: encoding, consolidation, retrieval.",
      title: "Reflection",
    },
    resource: { name: "hours", total: 5 },
    rounds: [
      {
        event: null,
        outcomes: [
          {
            invested: { consequence: "Good progress" },
            maintained: { consequence: "Treading water" },
            neglected: { consequence: "Fell behind" },
            priorityId: "study",
          },
          {
            invested: { consequence: "Energized" },
            maintained: { consequence: "OK" },
            neglected: { consequence: "Sluggish" },
            priorityId: "exercise",
          },
          {
            invested: { consequence: "Well rested" },
            maintained: { consequence: "Fine" },
            neglected: { consequence: "Exhausted" },
            priorityId: "sleep",
          },
        ],
        stateModifiers: null,
        tokenOverride: null,
      },
      {
        event: "The exam was moved to tomorrow!",
        outcomes: [
          {
            invested: { consequence: "Crammed effectively" },
            maintained: { consequence: "Light review" },
            neglected: { consequence: "Forgot key concepts" },
            priorityId: "study",
          },
          {
            invested: { consequence: "Clear mind" },
            maintained: { consequence: "Some tension" },
            neglected: { consequence: "High cortisol" },
            priorityId: "exercise",
          },
          {
            invested: { consequence: "Consolidated memories" },
            maintained: { consequence: "Partial consolidation" },
            neglected: { consequence: "No consolidation" },
            priorityId: "sleep",
          },
        ],
        stateModifiers: [{ delta: -1, priorityId: "sleep" }],
        tokenOverride: 4,
      },
    ],
    scenario: {
      text: "You have a big exam in 3 days.",
      title: "Exam Prep",
    },
  };
}

describe(saveTradeoffActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Tradeoff Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves intro + round steps + reflection and marks activity as completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Tradeoff ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "tradeoff",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Tradeoff ${randomUUID()}`,
    });

    const content = makeTradeoffContent();

    await saveTradeoffActivityStep({
      activityId: Number(activity.id),
      content,
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

    // 2 rounds → 1 intro + 2 rounds + 1 reflection = 4 steps
    expect(dbSteps).toHaveLength(4);

    expect(dbSteps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "tradeoff"],
      [2, "tradeoff"],
      [3, "static"],
    ]);

    // Verify intro step content
    const introContent = dbSteps[0]?.content as { title: string; variant: string };
    expect(introContent.variant).toBe("text");
    expect(introContent.title).toBe("Exam Prep");

    // Verify reflection step content
    const reflectionContent = dbSteps[3]?.content as { title: string; variant: string };
    expect(reflectionContent.variant).toBe("text");
    expect(reflectionContent.title).toBe("Reflection");

    // Verify round steps have priorities and outcomes
    const round1Content = dbSteps[1]?.content as { event: string | null; priorities: unknown[] };
    expect(round1Content.event).toBeNull();
    expect(round1Content.priorities).toHaveLength(3);

    const round2Content = dbSteps[2]?.content as {
      event: string | null;
      stateModifiers: unknown[];
      tokenOverride: number | null;
    };
    expect(round2Content.event).toBe("The exam was moved to tomorrow!");
    expect(round2Content.tokenOverride).toBe(4);
    expect(round2Content.stateModifiers).toHaveLength(1);

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveTradeoffActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveTradeoffActivity" }),
    );
  });

  test("streams error when DB transaction fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Tradeoff Error ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "tradeoff",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Tradeoff Fail ${randomUUID()}`,
    });

    await prisma.activity.delete({ where: { id: activity.id } });

    await saveTradeoffActivityStep({
      activityId: Number(activity.id),
      content: makeTradeoffContent(),
      workflowRunId: "workflow-error",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveTradeoffActivity" }),
    );
  });
});
