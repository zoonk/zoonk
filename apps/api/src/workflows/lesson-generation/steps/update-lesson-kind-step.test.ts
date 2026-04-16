import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { updateLessonKindStep } from "./update-lesson-kind-step";

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

describe(updateLessonKindStep, () => {
  let organizationId: string;
  let chapterId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Update Kind Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("streams error and throws when lesson does not exist", async () => {
    await expect(
      updateLessonKindStep({ kind: "language", lessonId: randomUUID() }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "updateLessonKind" }),
    );
  });

  test("updates the lesson kind in the database", async () => {
    const lesson = await lessonFixture({
      chapterId,
      kind: "core",
      organizationId,
      title: `Update Kind ${randomUUID()}`,
    });

    await updateLessonKindStep({ kind: "language", lessonId: lesson.id });

    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    expect(updated.kind).toBe("language");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "updateLessonKind" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "updateLessonKind" }),
    );
  });
});
