import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import { getLessonActivitiesStep } from "./get-lesson-activities-step";

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

describe(getLessonActivitiesStep, () => {
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
      title: `Get Activities Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns all activities with nested lesson/chapter/course/organization relations", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Get Activities ${randomUUID()}`,
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
    ]);

    const result = await getLessonActivitiesStep({ lessonId: lesson.id });

    expect(result).toHaveLength(2);
    expect(result[0]!.lesson.id).toBe(lesson.id);
    expect(result[0]!.lesson.chapter.id).toBe(chapterId);
    expect(result[0]!.lesson.chapter.course.id).toBe(courseId);
    expect(result[0]!.lesson.chapter.course.organization!.id).toBe(organizationId);
    expectTypeOf(result[0]!.id).toBeNumber();
    expect(result[0]!.position).toBe(0);
    expect(result[1]!.position).toBe(1);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "getLessonActivities" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "getLessonActivities" }),
    );
  });

  test("throws FatalError when lesson has no activities", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Get Activities Empty ${randomUUID()}`,
    });

    await expect(getLessonActivitiesStep({ lessonId: lesson.id })).rejects.toThrow(
      "No activities found for lesson",
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "getLessonActivities" }),
    );
  });

  test("excludes archived activities from the lesson activity list", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Archived Activities ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "vocabulary",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Active Activity ${randomUUID()}`,
      }),
      activityFixture({
        archivedAt: new Date(),
        generationStatus: "pending",
        kind: "reading",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Archived Activity ${randomUUID()}`,
      }),
    ]);

    const result = await getLessonActivitiesStep({ lessonId: lesson.id });

    expect(result).toHaveLength(1);
    expect(result[0]?.archivedAt).toBeNull();
    expect(result[0]?.kind).toBe("vocabulary");
  });

  test("loads only hidden replacement activities during regeneration", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "language",
      organizationId,
      title: `Replacement Activities ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        lessonId: lesson.id,
        organizationId,
        position: 0,
        title: `Published Activity ${randomUUID()}`,
      }),
      activityFixture({
        generationRunId: "regen-run-1",
        generationStatus: "pending",
        isPublished: false,
        kind: "reading",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Replacement Activity ${randomUUID()}`,
      }),
      activityFixture({
        archivedAt: new Date(),
        generationRunId: "old-regen-run",
        generationStatus: "pending",
        isPublished: false,
        kind: "quiz",
        lessonId: lesson.id,
        organizationId,
        position: 2,
        title: `Archived Replacement Activity ${randomUUID()}`,
      }),
    ]);

    const result = await getLessonActivitiesStep({
      lessonId: lesson.id,
      regeneration: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.isPublished).toBe(false);
    expect(result[0]?.kind).toBe("reading");
    expect(result[0]?.archivedAt).toBeNull();
  });

  test("throws FatalError when the lesson is outside the AI organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      organizationId: otherOrg.id,
      title: `Manual Activities Chapter ${randomUUID()}`,
    });
    const lesson = await lessonFixture({
      chapterId: otherChapter.id,
      kind: "language",
      organizationId: otherOrg.id,
      title: `Manual Activities Lesson ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: lesson.id,
      organizationId: otherOrg.id,
      position: 0,
      title: `Manual Activity ${randomUUID()}`,
    });

    await expect(getLessonActivitiesStep({ lessonId: lesson.id })).rejects.toThrow(
      "No activities found for lesson",
    );
  });
});
