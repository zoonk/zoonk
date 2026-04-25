import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { determineLessonKindStep } from "./determine-lesson-kind-step";
import { type LessonContext } from "./get-lesson-step";

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

const { generateLessonKindMock } = vi.hoisted(() => ({
  generateLessonKindMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lessons/kind", () => ({
  generateLessonKind: generateLessonKindMock,
}));

describe(determineLessonKindStep, () => {
  let context: LessonContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId: organization.id,
      title: `Determine Kind Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId: organization.id,
      title: `Determine Kind Lesson ${randomUUID()}`,
    });

    context = {
      ...lesson,
      _count: { activities: 0 },
      chapter: { ...chapter, course },
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the lesson kind from AI generation", async () => {
    generateLessonKindMock.mockResolvedValue({ data: { kind: "language" } });

    const result = await determineLessonKindStep(context);

    expect(result).toBe("language");

    expect(generateLessonKindMock).toHaveBeenCalledWith({
      chapterTitle: context.chapter.title,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "determineLessonKind" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "determineLessonKind" }),
    );
  });

  test("throws without streaming error when AI generation fails", async () => {
    generateLessonKindMock.mockRejectedValue(new Error("AI failure"));

    await expect(determineLessonKindStep(context)).rejects.toThrow("AI failure");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "determineLessonKind" }),
    );
  });
});
