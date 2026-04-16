import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { handleActivityFailureStep } from "./handle-failure-step";

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

describe(handleActivityFailureStep, () => {
  let organizationId: string;
  let chapterId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Handle Failure Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("marks activity as failed", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Handle Failure ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "running",
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: `Running Activity ${randomUUID()}`,
    });

    await handleActivityFailureStep({ activityId: activity.id });

    const updatedActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });

    expect(updatedActivity.generationStatus).toBe("failed");
  });
});
