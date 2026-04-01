import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { determineAppliedActivityStep } from "./determine-applied-activity-step";
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

const { generateAppliedActivityKindMock } = vi.hoisted(() => ({
  generateAppliedActivityKindMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lessons/applied-activity-kind", () => ({
  generateAppliedActivityKind: generateAppliedActivityKindMock,
}));

describe(determineAppliedActivityStep, () => {
  let context: LessonContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId: organization.id,
      title: `Applied Activity Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Supply Chain", "Communication"],
      organizationId: organization.id,
      title: `Applied Activity Lesson ${randomUUID()}`,
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

  test("returns the applied activity kind from AI generation", async () => {
    generateAppliedActivityKindMock.mockResolvedValue({
      data: { appliedActivityKind: "story" },
    });

    const result = await determineAppliedActivityStep(context);

    expect(result).toBe("story");

    expect(generateAppliedActivityKindMock).toHaveBeenCalledWith({
      chapterTitle: context.chapter.title,
      concepts: context.concepts,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description ?? "",
      lessonTitle: context.title,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "determineAppliedActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "determineAppliedActivity" }),
    );
  });

  test("returns null when AI classifies as no applied activity", async () => {
    generateAppliedActivityKindMock.mockResolvedValue({
      data: { appliedActivityKind: null },
    });

    const result = await determineAppliedActivityStep(context);

    expect(result).toBeNull();
  });

  test("returns null when AI generation fails (non-fatal)", async () => {
    generateAppliedActivityKindMock.mockRejectedValue(new Error("AI failure"));

    const result = await determineAppliedActivityStep(context);

    expect(result).toBeNull();

    const events = getStreamedEvents(writeMock);

    // Should still stream completed (not error) since failure is non-fatal
    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "determineAppliedActivity" }),
    );

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "determineAppliedActivity" }),
    );
  });
});
