import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setLessonAsRunningStep } from "./set-lesson-as-running-step";

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

describe(setLessonAsRunningStep, () => {
  let organizationId: string;
  let chapterId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Set Running Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("streams error and throws when lesson does not exist", async () => {
    await expect(
      setLessonAsRunningStep({ lessonId: 999_999_999, workflowRunId: "run-id" }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "setLessonAsRunning" }),
    );
  });

  test("updates lesson generation status to running with run ID", async () => {
    const lesson = await lessonFixture({
      chapterId,
      organizationId,
      title: `Set Running ${randomUUID()}`,
    });

    const workflowRunId = `run-${randomUUID()}`;

    await setLessonAsRunningStep({ lessonId: lesson.id, workflowRunId });

    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    expect(updated.generationStatus).toBe("running");
    expect(updated.generationRunId).toBe(workflowRunId);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setLessonAsRunning" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setLessonAsRunning" }),
    );
  });
});
