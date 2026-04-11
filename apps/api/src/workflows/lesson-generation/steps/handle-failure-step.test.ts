import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { handleLessonFailureStep } from "./handle-failure-step";

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

describe(handleLessonFailureStep, () => {
  let organizationId: number;
  let chapterId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Handle Lesson Failure Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("marks lesson as failed and keeps the last run ID for debugging", async () => {
    const lesson = await lessonFixture({
      chapterId,
      generationRunId: "old-run-id",
      generationStatus: "running",
      organizationId,
      title: `Lesson Failure ${randomUUID()}`,
    });

    await handleLessonFailureStep({ lessonId: lesson.id });

    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    expect(updated.generationStatus).toBe("failed");
    expect(updated.generationRunId).toBe("old-run-id");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "workflowError" }),
    );
  });
});
