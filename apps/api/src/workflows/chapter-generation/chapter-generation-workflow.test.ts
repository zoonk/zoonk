import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { CHAPTER_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { chapterGenerationWorkflow } from "./chapter-generation-workflow";

vi.mock("@zoonk/ai/tasks/chapters/lessons", () => ({
  generateChapterLessons: vi.fn().mockResolvedValue({
    data: {
      lessons: [
        { description: "Lesson 1 description", kind: "explanation", title: "Lesson 1" },
        { description: "Lesson 2 description", kind: "explanation", title: "Lesson 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/chapters/language-lessons", () => ({
  generateLanguageChapterLessons: vi.fn().mockResolvedValue({
    data: {
      lessons: [
        { description: "Lang Lesson 1 description", kind: "vocabulary", title: "Lang Lesson 1" },
        { description: "Lang Lesson 2 description", kind: "vocabulary", title: "Lang Lesson 2" },
      ],
    },
  }),
}));

vi.mock("@/workflows/lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: vi.fn().mockResolvedValue("ready"),
}));

describe(chapterGenerationWorkflow, () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
  });

  describe("early returns", () => {
    test("returns early when generationStatus is 'running' without streaming completion", async () => {
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

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === CHAPTER_COMPLETION_STEP && event.status === "completed",
      );
      expect(completionEvent).toBeUndefined();
    });

    test("streams completion when generationStatus is 'completed'", async () => {
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

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === CHAPTER_COMPLETION_STEP && event.status === "completed",
      );
      expect(completionEvent).toBeDefined();
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
    test("calls lessonGenerationWorkflow with first lesson's ID", async () => {
      const title = `Lesson Gen Chapter ${randomUUID()}`;
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

      expect(lessonGenerationWorkflow).toHaveBeenCalledWith(lessons[0]?.id);
    });

    test("sets chapter as completed before the first lesson generation runs", async () => {
      const title = `Completed Before Lesson Gen ${randomUUID()}`;
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      let chapterStatusDuringLessonGen: string | null = null;

      vi.mocked(lessonGenerationWorkflow).mockImplementationOnce(async () => {
        const dbChapter = await prisma.chapter.findUnique({
          where: { id: chapter.id },
        });
        chapterStatusDuringLessonGen = dbChapter?.generationStatus ?? null;
        return "ready";
      });

      await chapterGenerationWorkflow(chapter.id);

      expect(chapterStatusDuringLessonGen).toBe("completed");
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
    test("chapter stays completed when first lesson generation throws", async () => {
      vi.mocked(lessonGenerationWorkflow).mockRejectedValueOnce(
        new Error("Lesson generation failed"),
      );

      const title = `Lesson Fail Chapter ${randomUUID()}`;
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await expect(chapterGenerationWorkflow(chapter.id)).rejects.toThrow(
        "Lesson generation failed",
      );

      const dbChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id },
      });

      expect(dbChapter?.generationStatus).toBe("completed");
    });

    test("marks chapter as 'failed' when AI generation throws after retries", async () => {
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
      expect(dbChapter?.generationRunId).toBeNull();

      const errorEvent = getStreamedEvents().find(
        (event) => event.status === "error" && event.step === "workflowError",
      );
      expect(errorEvent).toBeDefined();
    });

    test("throws FatalError when chapter not found", async () => {
      const nonExistentId = randomUUID();

      await expect(chapterGenerationWorkflow(nonExistentId)).rejects.toThrow("Chapter not found");
    });
  });
});
