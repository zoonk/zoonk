import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { CHAPTER_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { chapterGenerationWorkflow } from "./chapter-generation-workflow";

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
  generateLessonKind: vi.fn().mockResolvedValue({ data: { kind: "explanation" } }),
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

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: vi.fn(({ kind, title }: { kind: string; title: string }) =>
    Promise.resolve({
      data: `https://example.com/${kind}/${encodeURIComponent(title)}.webp`,
      error: null,
    }),
  ),
}));

describe(chapterGenerationWorkflow, () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lessonGenerationWorkflow).mockResolvedValue("ready");
  });

  describe("early returns", () => {
    it("returns early when generationStatus is 'running' without streaming completion", async () => {
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "running",
        organizationId,
        title: `Running Chapter ${randomUUID()}`,
      });

      await chapterGenerationWorkflow(chapter.id);

      const dbChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });

      expect(dbChapter?.generationStatus).toBe("running");
      expect(generateChapterLessons).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === CHAPTER_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeUndefined();
    });

    it("streams completion when generationStatus is 'completed'", async () => {
      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "completed",
        organizationId,
        title: `Completed Chapter ${randomUUID()}`,
      });

      await chapterGenerationWorkflow(chapter.id);

      const dbChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });

      expect(dbChapter?.generationStatus).toBe("completed");
      expect(generateChapterLessons).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === CHAPTER_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeDefined();
    });

    it("completes a chapter that already has lesson rows without generating new content", async () => {
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

      const dbChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });
      const dbLessons = await prisma.lesson.findMany({ where: { chapterId: chapter.id } });

      expect(dbChapter?.generationStatus).toBe("completed");
      expect(dbChapter?.generationRunId).toBe("test-run-id");

      expect(dbLessons[0]?.imageUrl).toBeNull();

      expect(generateChapterLessons).not.toHaveBeenCalled();
      expect(generateContentThumbnailImage).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    it("starts the first three generated lessons in parallel without generating a chapter image", async () => {
      const title = `Lesson Gen Chapter ${randomUUID()}`;

      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      const lessonResolvers: (() => void)[] = [];

      vi.mocked(lessonGenerationWorkflow).mockImplementation(
        () =>
          new Promise((resolve) => {
            lessonResolvers.push(() => resolve("ready"));
          }),
      );

      const workflowPromise = chapterGenerationWorkflow(chapter.id);

      await vi.waitFor(() => {
        expect(lessonGenerationWorkflow).toHaveBeenCalledTimes(3);
      });

      lessonResolvers.forEach((resolveLesson) => resolveLesson());

      await workflowPromise;

      const [lessons, dbChapter] = await Promise.all([
        prisma.lesson.findMany({ orderBy: { position: "asc" }, where: { chapterId: chapter.id } }),
        prisma.chapter.findUnique({ where: { id: chapter.id } }),
      ]);

      expect(lessonGenerationWorkflow).toHaveBeenCalledTimes(3);
      expect(lessonGenerationWorkflow).toHaveBeenNthCalledWith(1, lessons[0]?.id);
      expect(lessonGenerationWorkflow).toHaveBeenNthCalledWith(2, lessons[1]?.id);
      expect(lessonGenerationWorkflow).toHaveBeenNthCalledWith(3, lessons[2]?.id);
      expect(lessons.every((lesson) => lesson.imageUrl === null)).toBe(true);

      expect(dbChapter?.imageUrl).toBeNull();
      expect(generateContentThumbnailImage).not.toHaveBeenCalled();
    });

    it("skips derived language lessons when starting the initial generated lesson batch", async () => {
      const languageCourse = await courseFixture({
        organizationId,
        targetLanguage: "es",
        title: `Language Course ${randomUUID()}`,
      });

      const chapter = await chapterFixture({
        courseId: languageCourse.id,
        generationStatus: "pending",
        organizationId,
        title: `Language Chapter ${randomUUID()}`,
      });

      await chapterGenerationWorkflow(chapter.id);

      const lessons = await prisma.lesson.findMany({
        orderBy: { position: "asc" },
        where: { chapterId: chapter.id },
      });

      const calledLessonIds = new Set(
        vi.mocked(lessonGenerationWorkflow).mock.calls.map(([lessonId]) => lessonId),
      );

      const calledLessonKinds = lessons
        .filter((lesson) => calledLessonIds.has(lesson.id))
        .map((lesson) => lesson.kind);

      expect(calledLessonKinds).toStrictEqual(["vocabulary", "vocabulary", "reading"]);
      expect(calledLessonKinds).not.toContain("translation");
      expect(calledLessonKinds).not.toContain("listening");
    });

    it("sets chapter as completed before the first lesson generation runs", async () => {
      const title = `Completed Before Lesson Gen ${randomUUID()}`;

      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      let chapterStatusDuringLessonGen: string | null = null;

      vi.mocked(lessonGenerationWorkflow).mockImplementationOnce(async () => {
        const dbChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });
        chapterStatusDuringLessonGen = dbChapter?.generationStatus ?? null;
        return "ready";
      });

      await chapterGenerationWorkflow(chapter.id);

      expect(chapterStatusDuringLessonGen).toBe("completed");
    });

    it("updates chapter status: pending → running → completed", async () => {
      const title = `Status Transition Chapter ${randomUUID()}`;

      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      const initialChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });
      expect(initialChapter?.generationStatus).toBe("pending");

      await chapterGenerationWorkflow(chapter.id);

      const finalChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });
      expect(finalChapter?.generationStatus).toBe("completed");
    });
  });

  describe("error handling", () => {
    it("keeps the chapter completed when an initial lesson generation fails", async () => {
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

      await expect(chapterGenerationWorkflow(chapter.id)).resolves.toBeUndefined();

      const dbChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });

      expect(dbChapter?.generationStatus).toBe("completed");
    });

    it("marks chapter as 'failed' when AI generation throws after retries", async () => {
      vi.mocked(generateChapterLessons).mockRejectedValueOnce(new Error("AI generation failed"));

      const title = `Error Chapter ${randomUUID()}`;

      const chapter = await chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await expect(chapterGenerationWorkflow(chapter.id)).rejects.toThrow("AI generation failed");

      const dbChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });

      expect(dbChapter?.generationStatus).toBe("failed");
      expect(dbChapter?.generationRunId).toBeNull();

      const errorEvent = getStreamedEvents().find(
        (event) => event.status === "error" && event.step === "workflowError",
      );

      expect(errorEvent).toBeDefined();
    });

    it("throws FatalError when chapter not found", async () => {
      const nonExistentId = randomUUID();

      await expect(chapterGenerationWorkflow(nonExistentId)).rejects.toThrow("Chapter not found");
    });
  });
});
