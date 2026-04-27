import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonContext } from "./get-lesson-step";
import { setLessonAsCompletedStep } from "./set-lesson-as-completed-step";

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

describe(setLessonAsCompletedStep, () => {
  let organizationId: string;
  let chapterId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Set Completed Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws without streaming error when lesson does not exist", async () => {
    const lesson = await lessonFixture({
      chapterId,
      organizationId,
      title: `Broken Lesson ${randomUUID()}`,
    });

    const context: LessonContext = {
      ...lesson,
      _count: { activities: 0 },
      chapter: { ...chapter, course },
      id: randomUUID(),
    };

    await expect(
      setLessonAsCompletedStep({
        context,
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "setLessonAsCompleted" }),
    );
  });

  test("updates lesson generation status to completed", async () => {
    const lesson = await lessonFixture({
      chapterId,
      generationRunId: "old-run-id",
      generationStatus: "running",
      organizationId,
      title: `Set Completed ${randomUUID()}`,
    });

    const context: LessonContext = {
      ...lesson,
      _count: { activities: 0 },
      chapter: { ...chapter, course },
    };

    await setLessonAsCompletedStep({
      context,
    });

    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    expect(updated.generationStatus).toBe("completed");
    expect(updated.generationRunId).toBe("old-run-id");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setLessonAsCompleted" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setLessonAsCompleted" }),
    );
  });
});
