import { randomUUID } from "node:crypto";
import { generateLessonActivities } from "@zoonk/ai/tasks/lessons/activities";
import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { lessonGenerationWorkflow } from "./lesson-generation-workflow";

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
}));

vi.mock("@zoonk/ai/tasks/lessons/kind", () => ({
  generateLessonKind: vi.fn().mockResolvedValue({
    data: { kind: "core" },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/activities", () => ({
  generateLessonActivities: vi.fn().mockResolvedValue({
    data: {
      activities: [
        { description: "Custom activity 1 description", title: "Custom Activity 1" },
        { description: "Custom activity 2 description", title: "Custom Activity 2" },
      ],
    },
  }),
}));

describe(lessonGenerationWorkflow, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Test Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("early returns", () => {
    test("returns early when generationStatus is 'running'", async () => {
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "running",
        organizationId,
        title: `Running Lesson ${randomUUID()}`,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("running");
      expect(generateLessonKind).not.toHaveBeenCalled();
    });

    test("streams completion when generationStatus is 'completed' and has activities", async () => {
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        organizationId,
        title: `Completed Lesson ${randomUUID()}`,
      });

      await activityFixture({
        lessonId: lesson.id,
        organizationId,
        title: `Existing Activity ${randomUUID()}`,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("completed");
      expect(generateLessonKind).not.toHaveBeenCalled();

      const completionCall = writeMock.mock.calls.find(
        (call: string[]) =>
          call[0]?.includes('"step":"setLessonAsCompleted"') &&
          call[0]?.includes('"status":"completed"'),
      );
      expect(completionCall).toBeDefined();
    });

    test("sets as completed and returns when lesson has existing activities but status not completed", async () => {
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title: `Lesson with Activities ${randomUUID()}`,
      });

      await activityFixture({
        lessonId: lesson.id,
        organizationId,
        title: `Existing Activity ${randomUUID()}`,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("completed");
      expect(dbLesson?.generationRunId).toBe("test-run-id");
      expect(generateLessonKind).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    test("marks lesson as 'failed' when AI generation throws and streams error", async () => {
      vi.mocked(generateLessonKind).mockRejectedValueOnce(new Error("AI generation failed"));

      const title = `Error Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await expect(lessonGenerationWorkflow(lesson.id)).rejects.toThrow("AI generation failed");

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("failed");
      expect(dbLesson?.generationRunId).toBeNull();

      const errorCall = writeMock.mock.calls.find(
        (call: string[]) =>
          call[0]?.includes('"status":"error"') && call[0]?.includes('"step":"workflowError"'),
      );
      expect(errorCall).toBeDefined();
    });

    test("marks lesson as 'failed' when custom activities generation throws", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "custom" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      vi.mocked(generateLessonActivities).mockRejectedValueOnce(
        new Error("Activities generation failed"),
      );

      const title = `Custom Error Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await expect(lessonGenerationWorkflow(lesson.id)).rejects.toThrow(
        "Activities generation failed",
      );

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("failed");
    });

    test("throws FatalError when lesson not found", async () => {
      const nonExistentId = 999_999_999;

      await expect(lessonGenerationWorkflow(nonExistentId)).rejects.toThrow("Lesson not found");
    });
  });

  describe("status transitions", () => {
    test("updates lesson status: pending → running → completed", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "core" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const title = `Status Transition Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      const initialLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });
      expect(initialLesson?.generationStatus).toBe("pending");

      await lessonGenerationWorkflow(lesson.id);

      const finalLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });
      expect(finalLesson?.generationStatus).toBe("completed");
      expect(finalLesson?.generationRunId).toBe("test-run-id");
    });
  });
});
