import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { markAllActivitiesAsRunningStep } from "./mark-all-activities-as-running-step";

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

describe(markAllActivitiesAsRunningStep, () => {
  let organizationId: number;
  let chapterId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Mark Running Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("marks all activities as running with the workflow run ID", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Mark Running ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "vocabulary",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Activity 1 ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "reading",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Activity 2 ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "translation",
        lessonId: lesson.id,
        organizationId,
        position: 2,
        title: `Activity 3 ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);
    const workflowRunId = `run-${randomUUID()}`;

    await markAllActivitiesAsRunningStep({ activities, workflowRunId });

    const updatedActivities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    expect(updatedActivities).toHaveLength(3);

    for (const activity of updatedActivities) {
      expect(activity).toMatchObject({
        generationRunId: workflowRunId,
        generationStatus: "running",
      });
    }

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setActivityAsRunning" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setActivityAsRunning" }),
    );
  });

  test("deletes existing steps for failed activities", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Mark Running Failed ${randomUUID()}`,
    });

    const failedActivity = await activityFixture({
      generationStatus: "failed",
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      position: 0,
      title: `Failed Activity ${randomUUID()}`,
    });

    await Promise.all([
      stepFixture({
        activityId: failedActivity.id,
        content: { text: "step 1", title: "Step 1", variant: "text" },
        kind: "static",
        position: 0,
      }),
      stepFixture({
        activityId: failedActivity.id,
        content: { text: "step 2", title: "Step 2", variant: "text" },
        kind: "static",
        position: 1,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);
    const workflowRunId = `run-${randomUUID()}`;

    await markAllActivitiesAsRunningStep({ activities, workflowRunId });

    const [remainingSteps, updatedActivity] = await Promise.all([
      prisma.step.findMany({ where: { activityId: failedActivity.id } }),
      prisma.activity.findUniqueOrThrow({ where: { id: failedActivity.id } }),
    ]);

    expect(remainingSteps).toHaveLength(0);
    expect(updatedActivity).toMatchObject({
      generationRunId: workflowRunId,
      generationStatus: "running",
    });
  });

  test("completes silently when activities list is empty", async () => {
    await expect(
      markAllActivitiesAsRunningStep({ activities: [], workflowRunId: "run-empty" }),
    ).resolves.toBeUndefined();
  });

  test("streams error and throws when DB transaction fails", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Mark Running Error ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: lesson.id,
      organizationId,
      position: 0,
      title: `Activity Error ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    // Delete the activity so the prisma.activity.update inside the transaction fails
    await prisma.activity.delete({ where: { id: activity.id } });

    await expect(
      markAllActivitiesAsRunningStep({ activities, workflowRunId: "run-error" }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "setActivityAsRunning" }),
    );
  });
});
