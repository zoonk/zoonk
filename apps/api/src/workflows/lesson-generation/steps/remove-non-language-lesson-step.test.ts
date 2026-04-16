import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { removeNonLanguageLessonStep } from "./remove-non-language-lesson-step";

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

describe(removeNonLanguageLessonStep, () => {
  let organizationId: string;
  let chapterId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Remove Lesson Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("streams error and throws when lesson does not exist", async () => {
    await expect(removeNonLanguageLessonStep({ lessonId: 999_999_999 })).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "removeNonLanguageLesson" }),
    );
  });

  test("deletes the lesson from the database", async () => {
    const lesson = await lessonFixture({
      chapterId,
      organizationId,
      title: `Remove Me ${randomUUID()}`,
    });

    await removeNonLanguageLessonStep({ lessonId: lesson.id });

    const deleted = await prisma.lesson.findUnique({ where: { id: lesson.id } });

    expect(deleted).toBeNull();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "removeNonLanguageLesson" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "removeNonLanguageLesson" }),
    );
  });
});
