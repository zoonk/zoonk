import { randomUUID } from "node:crypto";
import { generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { chapterGenerationWorkflow } from "./chapter-generation-workflow";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
}));

vi.mock("@zoonk/ai/tasks/chapters/lessons", () => ({
  generateChapterLessons: vi.fn().mockResolvedValue({
    data: {
      lessons: [
        { description: "Lesson 1 description", title: "Lesson 1" },
        { description: "Lesson 2 description", title: "Lesson 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/kind", () => ({
  generateLessonKind: vi.fn().mockResolvedValue({
    data: { kind: "core" },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/activities", () => ({
  generateLessonActivities: vi.fn().mockResolvedValue({
    data: { activities: [] },
  }),
}));

vi.mock("@zoonk/core/cache/revalidate", () => ({
  revalidateMainApp: vi.fn().mockResolvedValue(null),
}));

describe(chapterGenerationWorkflow, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("early returns", () => {
    test("returns early when generationStatus is 'running'", async () => {
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "running",
        organizationId,
        title: `Running Chapter ${randomUUID()}`,
      });

      await chapterGenerationWorkflow(chapter.id);

      const dbChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id },
      });

      expect(dbChapter?.generationStatus).toBe("running");
      expect(generateChapterLessons).not.toHaveBeenCalled();
    });

    test("returns early when generationStatus is 'completed'", async () => {
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "completed",
        organizationId,
        title: `Completed Chapter ${randomUUID()}`,
      });

      await chapterGenerationWorkflow(chapter.id);

      const dbChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id },
      });

      expect(dbChapter?.generationStatus).toBe("completed");
      expect(generateChapterLessons).not.toHaveBeenCalled();
    });

    test("sets as completed and returns when chapter has existing lessons", async () => {
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title: `Chapter with Lessons ${randomUUID()}`,
      });

      await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Existing Lesson ${randomUUID()}`,
      });

      await chapterGenerationWorkflow(chapter.id);

      const dbChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id },
      });

      expect(dbChapter?.generationStatus).toBe("completed");
      expect(dbChapter?.generationRunId).toBe("test-run-id");
      expect(generateChapterLessons).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    test("generates lessons for pending chapter", async () => {
      const title = `Pending Chapter ${randomUUID()}`;
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await chapterGenerationWorkflow(chapter.id);

      const dbChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id },
      });

      expect(dbChapter?.generationStatus).toBe("completed");
      expect(dbChapter?.generationRunId).toBe("test-run-id");
    });

    test("creates lessons in database with correct data", async () => {
      const title = `Chapter for Lesson Test ${randomUUID()}`;
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await chapterGenerationWorkflow(chapter.id);

      const lessons = await prisma.lesson.findMany({
        orderBy: { position: "asc" },
        where: { chapterId: chapter.id },
      });

      expect(lessons).toHaveLength(2);
      expect(lessons[0]?.title).toBe("Lesson 1");
      expect(lessons[0]?.description).toBe("Lesson 1 description");
      expect(lessons[0]?.position).toBe(0);
      expect(lessons[1]?.title).toBe("Lesson 2");
      expect(lessons[1]?.description).toBe("Lesson 2 description");
      expect(lessons[1]?.position).toBe(1);
    });

    test("updates chapter status: pending → running → completed", async () => {
      const title = `Status Transition Chapter ${randomUUID()}`;
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      const initialChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id },
      });
      expect(initialChapter?.generationStatus).toBe("pending");

      await chapterGenerationWorkflow(chapter.id);

      const finalChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id },
      });
      expect(finalChapter?.generationStatus).toBe("completed");
    });
  });

  describe("error handling", () => {
    test("marks chapter as 'failed' when AI generation throws", async () => {
      vi.mocked(generateChapterLessons).mockRejectedValueOnce(new Error("AI generation failed"));

      const title = `Error Chapter ${randomUUID()}`;
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await expect(chapterGenerationWorkflow(chapter.id)).rejects.toThrow("AI generation failed");

      const dbChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id },
      });

      expect(dbChapter?.generationStatus).toBe("failed");
    });

    test("throws FatalError when chapter not found", async () => {
      const nonExistentId = 999_999_999;

      await expect(chapterGenerationWorkflow(nonExistentId)).rejects.toThrow("Chapter not found");
    });
  });
});
