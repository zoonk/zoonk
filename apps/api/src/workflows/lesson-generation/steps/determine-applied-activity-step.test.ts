import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
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
  let organizationId: number;
  let chapterId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;

    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Applied Activity Chapter ${randomUUID()}`,
    });

    chapterId = chapter.id;

    const lesson = await lessonFixture({
      chapterId,
      concepts: ["Supply Chain", "Communication"],
      organizationId,
      position: 0,
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
      recentAppliedKinds: [],
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "determineAppliedActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "determineAppliedActivity" }),
    );
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

  test("passes recent applied kinds from preceding lessons", async () => {
    generateAppliedActivityKindMock.mockResolvedValue({
      data: { appliedActivityKind: "investigation" },
    });

    // Create two preceding lessons with applied activities.
    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId,
        organizationId,
        position: 10,
        title: `Preceding Lesson 1 ${randomUUID()}`,
      }),
      lessonFixture({
        chapterId,
        organizationId,
        position: 20,
        title: `Preceding Lesson 2 ${randomUUID()}`,
      }),
    ]);

    await Promise.all([
      activityFixture({
        kind: "story",
        lessonId: lesson1.id,
        organizationId,
      }),
      activityFixture({
        kind: "investigation",
        lessonId: lesson2.id,
        organizationId,
      }),
    ]);

    // Current lesson at position 30 should see both preceding kinds.
    const laterContext: LessonContext = {
      ...context,
      position: 30,
    };

    await determineAppliedActivityStep(laterContext);

    expect(generateAppliedActivityKindMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recentAppliedKinds: ["investigation", "story"],
      }),
    );
  });
});
