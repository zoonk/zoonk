import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { generateCourseCategories } from "@zoonk/ai/tasks/courses/categories";
import { generateCourseChapters } from "@zoonk/ai/tasks/courses/chapters";
import { generateCourseDescription } from "@zoonk/ai/tasks/courses/description";
import {
  generateCourseIdentitySearchQueries,
  resolveCourseIdentity,
} from "@zoonk/ai/tasks/courses/identity";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { COURSE_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { chapterImagesWorkflow } from "./chapter-images-workflow";
import { courseGenerationWorkflow } from "./course-generation-workflow";

const { startMock } = vi.hoisted(() => ({
  startMock: vi.fn().mockResolvedValue({ runId: "chapter-images-run-id" }),
}));

vi.mock("workflow/api", () => ({ start: startMock }));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: vi
    .fn()
    .mockResolvedValue({ data: { description: "Generated course description" } }),
}));

vi.mock("@zoonk/ai/tasks/courses/chapters", () => ({
  generateCourseChapters: vi.fn().mockResolvedValue({
    data: {
      chapters: [
        { description: "Chapter 1 description", title: "Chapter 1" },
        { description: "Chapter 2 description", title: "Chapter 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/courses/language-chapters", () => ({
  generateLanguageCourseChapters: vi.fn().mockResolvedValue({
    data: {
      chapters: [
        { description: "Lang Chapter 1 description", title: "Lang Chapter 1" },
        { description: "Lang Chapter 2 description", title: "Lang Chapter 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/courses/identity", () => ({
  generateCourseIdentitySearchQueries: vi
    .fn()
    .mockResolvedValue({ data: { queries: [] }, systemPrompt: "", usage: {}, userPrompt: "" }),
  resolveCourseIdentity: vi
    .fn()
    .mockResolvedValue({
      data: { courseId: null, decision: "createNew", reason: "no matching course" },
      systemPrompt: "",
      usage: {},
      userPrompt: "",
    }),
}));

vi.mock("@zoonk/ai/tasks/courses/categories", () => ({
  generateCourseCategories: vi
    .fn()
    .mockResolvedValue({ data: { categories: ["programming", "technology"] } }),
}));

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: vi.fn(({ kind, title }: { kind: string; title: string }) =>
    Promise.resolve({
      data: `https://example.com/${kind}/${encodeURIComponent(title)}.webp`,
      error: null,
    }),
  ),
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
  generateLessonKind: vi.fn().mockResolvedValue({ data: { kind: "explanation" } }),
}));

vi.mock("@/workflows/lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: vi.fn().mockResolvedValue("ready"),
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

vi.mock("./_internal/get-or-create-course", async (importOriginal) => {
  const mod = await importOriginal();

  return {
    getOrCreateCourse: vi.fn(
      (mod as { getOrCreateCourse: typeof getOrCreateCourse }).getOrCreateCourse,
    ),
  };
});

describe(courseGenerationWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
  });

  describe("early returns", () => {
    it("returns when suggestion not found", async () => {
      const nonExistentId = randomUUID();

      await expect(courseGenerationWorkflow(nonExistentId)).rejects.toThrow(
        "Course suggestion not found",
      );

      expect(generateCourseDescription).not.toHaveBeenCalled();
    });

    it("returns when suggestion status is 'running' without streaming completion", async () => {
      const suggestion = await courseSuggestionFixture({
        generationStatus: "running",
        title: `Running Suggestion ${randomUUID()}`,
      });

      await courseGenerationWorkflow(suggestion.id);

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(dbSuggestion?.generationStatus).toBe("running");
      expect(generateCourseDescription).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeUndefined();
    });

    it("streams completion when suggestion status is 'completed'", async () => {
      const suggestion = await courseSuggestionFixture({
        generationStatus: "completed",
        title: `Completed Suggestion ${randomUUID()}`,
      });

      await courseGenerationWorkflow(suggestion.id);

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(dbSuggestion?.generationStatus).toBe("completed");
      expect(generateCourseDescription).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeDefined();
    });

    it("returns when existing course status is 'running' without streaming completion", async () => {
      const title = `Existing Running Course ${randomUUID()}`;
      const slug = toSlug(title);

      await courseFixture({ generationStatus: "running", organizationId, slug, title });

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(dbSuggestion?.generationStatus).toBe("pending");
      expect(dbSuggestion?.courseId).not.toBeNull();
      expect(generateCourseDescription).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeUndefined();
    });

    it("streams completion when existing course status is 'completed'", async () => {
      const title = `Existing Completed Course ${randomUUID()}`;
      const slug = toSlug(title);

      await courseFixture({ generationStatus: "completed", organizationId, slug, title });

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(dbSuggestion?.courseId).not.toBeNull();
      expect(dbSuggestion?.generationStatus).toBe("completed");
      expect(generateCourseDescription).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeDefined();
    });
  });

  describe("happy path", () => {
    it("triggers chapter generation for first chapter", async () => {
      const title = `First Chapter Gen Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        include: { chapters: { include: { lessons: true }, orderBy: { position: "asc" } } },
        where: { slug },
      });

      const firstChapter = course?.chapters[0];
      expect(firstChapter?.generationStatus).toBe("completed");
      expect(firstChapter?.lessons).toHaveLength(5);
      expect(firstChapter?.imageUrl).toBeNull();

      const secondChapter = course?.chapters[1];
      expect(secondChapter?.generationStatus).toBe("pending");
      expect(secondChapter?.lessons).toHaveLength(0);
      expect(secondChapter?.imageUrl).toBeNull();

      expect(startMock).toHaveBeenCalledWith(chapterImagesWorkflow, [
        expect.arrayContaining([
          expect.objectContaining({ id: firstChapter?.id, title: "Chapter 1" }),
          expect.objectContaining({ id: secondChapter?.id, title: "Chapter 2" }),
        ]),
      ]);
    });
  });

  describe("existing course resumption", () => {
    it("resumes generation for failed course", async () => {
      const title = `Failed Course Resume ${randomUUID()}`;
      const slug = toSlug(title);

      const existingCourse = await prisma.course.create({
        data: {
          description: null,
          generationRunId: null,
          generationStatus: "failed",
          imageUrl: null,
          isPublished: true,
          language: "en",
          normalizedTitle: normalizeString(title),
          organizationId,
          slug,
          title,
        },
      });

      const suggestion = await courseSuggestionFixture({
        courseId: existingCourse.id,
        generationStatus: "failed",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findUnique({ where: { id: existingCourse.id } });

      expect(course?.generationStatus).toBe("completed");
      expect(course?.description).toBe("Generated course description");
    });

    it("skips generation for content that already exists", async () => {
      const title = `Partial Course ${randomUUID()}`;
      const slug = toSlug(title);

      const existingCourse = await courseFixture({
        description: "Existing description",
        generationStatus: "failed",
        imageUrl: "https://example.com/existing-image.webp",
        organizationId,
        slug,
        title,
      });

      const [suggestion] = await Promise.all([
        courseSuggestionFixture({
          courseId: existingCourse.id,
          generationStatus: "failed",
          slug,
          title,
        }),
        courseCategoryFixture({ category: "programming", courseId: existingCourse.id }),
        chapterFixture({
          courseId: existingCourse.id,
          organizationId,
          title: `Existing Chapter ${randomUUID()}`,
        }),
      ]);

      await courseGenerationWorkflow(suggestion.id);

      expect(generateCourseDescription).not.toHaveBeenCalled();
      expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
      expect(resolveCourseIdentity).not.toHaveBeenCalled();
      expect(generateCourseCategories).not.toHaveBeenCalled();
      expect(generateCourseChapters).not.toHaveBeenCalled();

      expect(generateContentThumbnailImage).not.toHaveBeenCalledWith(
        expect.objectContaining({ kind: "course" }),
      );
    });
  });

  describe("error handling", () => {
    it("marks course and suggestion as 'failed' when generation fails after retries", async () => {
      vi.mocked(generateCourseDescription).mockRejectedValueOnce(new Error("AI generation failed"));

      const title = `Error Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await expect(courseGenerationWorkflow(suggestion.id)).rejects.toThrow();

      const course = await prisma.course.findFirst({ where: { slug } });

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(course?.generationStatus).toBe("failed");
      expect(course?.generationRunId).toBeNull();
      expect(dbSuggestion?.generationStatus).toBe("failed");
      expect(dbSuggestion?.generationRunId).toBeNull();

      const errorEvent = getStreamedEvents().find(
        (event) => event.status === "error" && event.step === "workflowError",
      );

      expect(errorEvent).toBeDefined();
    });

    it("marks suggestion as 'failed' when getOrCreateCourse fails", async () => {
      vi.mocked(getOrCreateCourse).mockRejectedValueOnce(new Error("Organization not found"));

      const title = `Init Fail Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await expect(courseGenerationWorkflow(suggestion.id)).rejects.toThrow();

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(dbSuggestion?.generationStatus).toBe("failed");

      const errorEvent = getStreamedEvents().find(
        (event) => event.status === "error" && event.step === "workflowError",
      );

      expect(errorEvent).toBeDefined();
    });

    it("chapter generation errors don't mark course as failed", async () => {
      vi.mocked(generateChapterLessons).mockRejectedValueOnce(
        new Error("Chapter generation failed"),
      );

      const title = `Chapter Error Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await expect(courseGenerationWorkflow(suggestion.id)).rejects.toThrow(
        "Chapter generation failed",
      );

      const course = await prisma.course.findFirst({
        include: { chapters: { orderBy: { position: "asc" } } },
        where: { slug },
      });

      expect(course?.generationStatus).toBe("completed");

      const firstChapter = course?.chapters[0];
      expect(firstChapter?.generationStatus).toBe("failed");
    });

    it("chapter image workflow start errors don't fail the course workflow", async () => {
      startMock.mockRejectedValueOnce(new Error("Chapter image workflow failed to start"));

      const title = `Chapter Image Error Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await expect(courseGenerationWorkflow(suggestion.id)).resolves.toBeUndefined();

      const course = await prisma.course.findFirst({
        include: { chapters: { orderBy: { position: "asc" } } },
        where: { slug },
      });

      expect(course?.generationStatus).toBe("completed");
      expect(course?.chapters[0]?.generationStatus).toBe("completed");
      expect(course?.chapters[0]?.imageUrl).toBeNull();
      expect(course?.chapters[1]?.imageUrl).toBeNull();
    });
  });
});
