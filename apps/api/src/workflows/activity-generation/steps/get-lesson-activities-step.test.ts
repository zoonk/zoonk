import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
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

    const result = await getLessonActivitiesStep(lesson.id);

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

    await expect(getLessonActivitiesStep(lesson.id)).rejects.toThrow(
      "No activities found for lesson",
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "getLessonActivities" }),
    );
  });
});
