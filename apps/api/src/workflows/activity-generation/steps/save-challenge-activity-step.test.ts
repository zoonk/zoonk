import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { type ActivityChallengeSchema } from "@zoonk/ai/tasks/activities/core/challenge";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveChallengeActivityStep } from "./save-challenge-activity-step";

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

describe(saveChallengeActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Challenge Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves intro, multipleChoice, and reflection steps and marks activity as completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Challenge ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const data: ActivityChallengeSchema = {
      intro: `Welcome to this challenge ${randomUUID()}`,
      reflection: `Great job reflecting ${randomUUID()}`,
      steps: [
        {
          context: "You are a project manager facing a deadline.",
          options: [
            {
              consequence: "The team appreciates your transparency.",
              effects: [{ dimension: "trust", impact: "positive" }],
              text: "Communicate openly with stakeholders",
            },
            {
              consequence: "The team feels pressured.",
              effects: [{ dimension: "trust", impact: "negative" }],
              text: "Push the team to work overtime",
            },
          ],
          question: "What do you do?",
        },
      ],
    };

    await saveChallengeActivityStep({
      activityId: Number(activity.id),
      data,
      workflowRunId: "workflow-1",
    });

    const [steps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: activity.id },
      }),
    ]);

    expect(steps).toHaveLength(3);

    expect(steps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "multipleChoice"],
      [2, "static"],
    ]);

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveChallengeActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveChallengeActivity" }),
    );
  });

  test("streams error and marks activity as failed when DB transaction fails", async () => {
    const invalidActivityId = 999_999_999;

    const data: ActivityChallengeSchema = {
      intro: "Intro text",
      reflection: "Reflection text",
      steps: [
        {
          context: "Context",
          options: [
            {
              consequence: "Good outcome.",
              effects: [{ dimension: "trust", impact: "positive" }],
              text: "Option A",
            },
            {
              consequence: "Bad outcome.",
              effects: [{ dimension: "trust", impact: "negative" }],
              text: "Option B",
            },
          ],
          question: "What do you do?",
        },
      ],
    };

    await saveChallengeActivityStep({
      activityId: invalidActivityId,
      data,
      workflowRunId: "workflow-error",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveChallengeActivity" }),
    );
  });
});
