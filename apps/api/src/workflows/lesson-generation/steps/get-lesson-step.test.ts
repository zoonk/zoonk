import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getLessonStep } from "./get-lesson-step";

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

describe(getLessonStep, () => {
  let organizationId: number;
  let chapterId: number;
  let courseId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    courseId = course.id;
    const chapter = await chapterFixture({
      courseId,
      organizationId,
      title: `Get Lesson Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns lesson with chapter, course, and activity count", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Get Lesson ${randomUUID()}`,
    });

    const result = await getLessonStep(lesson.id);

    expect(result.id).toBe(lesson.id);
    expect(result.chapter.id).toBe(chapterId);
    expect(result.chapter.course.id).toBe(courseId);
    expect(result._count.activities).toBe(0);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "getLesson" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "getLesson" }),
    );
  });

  test("throws FatalError when lesson does not exist", async () => {
    await expect(getLessonStep(999_999_999)).rejects.toThrow("Lesson not found");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(expect.objectContaining({ status: "error", step: "getLesson" }));
  });
});
