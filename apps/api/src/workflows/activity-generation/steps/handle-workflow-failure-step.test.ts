import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { handleWorkflowFailureStep } from "./handle-workflow-failure-step";

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

describe(handleWorkflowFailureStep, () => {
  let organizationId: string;
  let chapterId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Workflow Failure Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("marks running published activities as failed during normal generation", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Workflow Failure ${randomUUID()}`,
    });

    const [runningMatchingActivity, runningOtherActivity, completedMatchingActivity] =
      await Promise.all([
        activityFixture({
          generationRunId: `run-${randomUUID()}`,
          generationStatus: "running",
          isPublished: true,
          kind: "vocabulary",
          lessonId: lesson.id,
          organizationId,
          position: 0,
          title: `Running Matching ${randomUUID()}`,
        }),
        activityFixture({
          generationRunId: `run-${randomUUID()}`,
          generationStatus: "running",
          isPublished: false,
          kind: "reading",
          lessonId: lesson.id,
          organizationId,
          position: 1,
          title: `Running Other ${randomUUID()}`,
        }),
        activityFixture({
          generationRunId: `run-${randomUUID()}`,
          generationStatus: "completed",
          isPublished: true,
          kind: "translation",
          lessonId: lesson.id,
          organizationId,
          position: 2,
          title: `Completed Matching ${randomUUID()}`,
        }),
      ]);

    await handleWorkflowFailureStep({ lessonId: lesson.id });

    const [updatedRunningMatching, updatedRunningOther, updatedCompletedMatching] =
      await Promise.all([
        prisma.activity.findUniqueOrThrow({ where: { id: runningMatchingActivity.id } }),
        prisma.activity.findUniqueOrThrow({ where: { id: runningOtherActivity.id } }),
        prisma.activity.findUniqueOrThrow({ where: { id: completedMatchingActivity.id } }),
      ]);

    expect(updatedRunningMatching).toMatchObject({
      generationStatus: "failed",
      isPublished: true,
    });

    expect(updatedRunningOther).toMatchObject({
      generationStatus: "running",
      isPublished: false,
    });

    expect(updatedCompletedMatching).toMatchObject({
      generationStatus: "completed",
    });
  });

  test("streams error event", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Workflow Failure Stream ${randomUUID()}`,
    });

    await handleWorkflowFailureStep({ lessonId: lesson.id });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "workflowError" }),
    );
  });
});
