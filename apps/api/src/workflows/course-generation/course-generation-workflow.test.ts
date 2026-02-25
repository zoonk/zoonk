import { randomUUID } from "node:crypto";
import { generateChapterLessons } from "@zoonk/ai/tasks/chapters/lessons";
import { generateAlternativeTitles } from "@zoonk/ai/tasks/courses/alternative-titles";
import { generateCourseCategories } from "@zoonk/ai/tasks/courses/categories";
import { generateCourseChapters } from "@zoonk/ai/tasks/courses/chapters";
import { generateCourseDescription } from "@zoonk/ai/tasks/courses/description";
import { generateLanguageCourseChapters } from "@zoonk/ai/tasks/courses/language-chapters";
import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { generateCourseImage } from "@zoonk/core/courses/image";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import {
  courseAlternativeTitleFixture,
  courseCategoryFixture,
  courseFixture,
} from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { toSlug } from "@zoonk/utils/string";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { courseGenerationWorkflow } from "./course-generation-workflow";

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

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: vi.fn().mockResolvedValue({
    data: { description: "Generated course description" },
  }),
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

vi.mock("@zoonk/ai/tasks/courses/alternative-titles", () => ({
  generateAlternativeTitles: vi.fn().mockImplementation(() =>
    Promise.resolve({
      data: { alternatives: [`Alt Title ${randomUUID()}`, `Alt Title ${randomUUID()}`] },
    }),
  ),
}));

vi.mock("@zoonk/ai/tasks/courses/categories", () => ({
  generateCourseCategories: vi.fn().mockResolvedValue({
    data: { categories: ["programming", "technology"] },
  }),
}));

vi.mock("@zoonk/core/courses/image", () => ({
  generateCourseImage: vi.fn().mockResolvedValue({
    data: "https://example.com/course-image.webp",
    error: null,
  }),
}));

vi.mock("@zoonk/core/cache/revalidate", () => ({
  revalidateMainApp: vi.fn().mockResolvedValue(null),
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

vi.mock("@zoonk/ai/tasks/chapters/language-lessons", () => ({
  generateLanguageChapterLessons: vi.fn().mockResolvedValue({
    data: {
      lessons: [
        { description: "Lang Lesson 1 description", title: "Lang Lesson 1" },
        { description: "Lang Lesson 2 description", title: "Lang Lesson 2" },
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

describe(courseGenerationWorkflow, () => {
  let organizationId: number;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("early returns", () => {
    test("returns when suggestion not found", async () => {
      const nonExistentId = 999_999_999;

      await expect(courseGenerationWorkflow(nonExistentId)).rejects.toThrow(
        "Course suggestion not found",
      );

      expect(generateCourseDescription).not.toHaveBeenCalled();
    });

    test("returns when suggestion status is 'running'", async () => {
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
    });

    test("returns when suggestion status is 'completed'", async () => {
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
    });

    test("returns when existing course status is 'running'", async () => {
      const title = `Existing Running Course ${randomUUID()}`;
      const slug = toSlug(title);

      await courseFixture({
        generationStatus: "running",
        organizationId,
        slug,
        title,
      });

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
      expect(generateCourseDescription).not.toHaveBeenCalled();
    });

    test("returns when existing course status is 'completed'", async () => {
      const title = `Existing Completed Course ${randomUUID()}`;
      const slug = toSlug(title);

      await courseFixture({
        generationStatus: "completed",
        organizationId,
        slug,
        title,
      });

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
      expect(generateCourseDescription).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    test("creates course from suggestion with correct data", async () => {
      const title = `New Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        description: "Suggestion description",
        generationStatus: "pending",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        where: { slug },
      });

      expect(course).not.toBeNull();
      expect(course?.title).toBe(title);
      expect(course?.organizationId).toBe(organizationId);
      expect(course?.generationStatus).toBe("completed");
    });

    test("generates description, image, chapters, categories, alternative titles", async () => {
      const title = `Full Generation Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        include: {
          alternativeTitles: true,
          categories: true,
          chapters: true,
        },
        where: { slug },
      });

      expect(course?.description).toBe("Generated course description");
      expect(course?.imageUrl).toBe("https://example.com/course-image.webp");
      expect(course?.chapters).toHaveLength(2);
      expect(course?.categories).toHaveLength(2);
      expect(course?.alternativeTitles).toHaveLength(2);
    });

    test("creates chapters in database", async () => {
      const title = `Chapter Creation Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        include: {
          chapters: {
            orderBy: { position: "asc" },
          },
        },
        where: { slug },
      });

      expect(course?.chapters).toHaveLength(2);
      expect(course?.chapters[0]?.title).toBe("Chapter 1");
      expect(course?.chapters[0]?.description).toBe("Chapter 1 description");
      expect(course?.chapters[0]?.position).toBe(0);
      expect(course?.chapters[1]?.title).toBe("Chapter 2");
      expect(course?.chapters[1]?.position).toBe(1);
    });

    test("triggers chapter generation for first chapter", async () => {
      const title = `First Chapter Gen Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        include: {
          chapters: {
            include: {
              lessons: true,
            },
            orderBy: { position: "asc" },
          },
        },
        where: { slug },
      });

      const firstChapter = course?.chapters[0];
      expect(firstChapter?.generationStatus).toBe("completed");
      expect(firstChapter?.lessons).toHaveLength(2);

      const secondChapter = course?.chapters[1];
      expect(secondChapter?.generationStatus).toBe("pending");
      expect(secondChapter?.lessons).toHaveLength(0);
    });

    test("updates suggestion status to 'completed'", async () => {
      const title = `Suggestion Complete Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(dbSuggestion?.generationStatus).toBe("completed");
    });
  });

  describe("existing course resumption", () => {
    test("resumes generation for failed course", async () => {
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
          normalizedTitle: title.toLowerCase(),
          organizationId,
          slug,
          title,
        },
      });

      const suggestion = await courseSuggestionFixture({
        generationStatus: "failed",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findUnique({
        where: { id: existingCourse.id },
      });

      expect(course?.generationStatus).toBe("completed");
      expect(course?.description).toBe("Generated course description");
    });

    test("skips generation for content that already exists", async () => {
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

      await courseAlternativeTitleFixture({
        courseId: existingCourse.id,
        language: "en",
        slug: `alt-${slug}`,
      });

      await courseCategoryFixture({
        category: "programming",
        courseId: existingCourse.id,
      });

      await chapterFixture({
        courseId: existingCourse.id,
        organizationId,
        title: `Existing Chapter ${randomUUID()}`,
      });

      const suggestion = await courseSuggestionFixture({
        generationStatus: "failed",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      expect(generateCourseDescription).not.toHaveBeenCalled();
      expect(generateCourseImage).not.toHaveBeenCalled();
      expect(generateAlternativeTitles).not.toHaveBeenCalled();
      expect(generateCourseCategories).not.toHaveBeenCalled();
      expect(generateCourseChapters).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    test("marks course and suggestion as 'failed' on error", async () => {
      vi.mocked(generateCourseDescription).mockRejectedValueOnce(new Error("AI generation failed"));

      const title = `Error Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await expect(courseGenerationWorkflow(suggestion.id)).rejects.toThrow();

      const course = await prisma.course.findFirst({
        where: { slug },
      });

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(course?.generationStatus).toBe("failed");
      expect(dbSuggestion?.generationStatus).toBe("failed");
    });

    test("marks course and suggestion as 'failed' when generateCourseCategories throws", async () => {
      vi.mocked(generateCourseCategories).mockRejectedValueOnce(
        new Error("Categories generation failed"),
      );

      const title = `Error Course Categories ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await expect(courseGenerationWorkflow(suggestion.id)).rejects.toThrow();

      const course = await prisma.course.findFirst({
        where: { slug },
      });

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(course?.generationStatus).toBe("failed");
      expect(dbSuggestion?.generationStatus).toBe("failed");
    });

    test("marks course and suggestion as 'failed' when generateAlternativeTitles throws", async () => {
      vi.mocked(generateAlternativeTitles).mockRejectedValueOnce(
        new Error("Alternative titles generation failed"),
      );

      const title = `Error Course Alt Titles ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await expect(courseGenerationWorkflow(suggestion.id)).rejects.toThrow();

      const course = await prisma.course.findFirst({
        where: { slug },
      });

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(course?.generationStatus).toBe("failed");
      expect(dbSuggestion?.generationStatus).toBe("failed");
    });

    test("marks course and suggestion as 'failed' when generateCourseChapters throws", async () => {
      vi.mocked(generateCourseChapters).mockRejectedValueOnce(
        new Error("Chapters generation failed"),
      );

      const title = `Error Course Chapters ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        title,
      });

      await expect(courseGenerationWorkflow(suggestion.id)).rejects.toThrow();

      const course = await prisma.course.findFirst({
        where: { slug },
      });

      const dbSuggestion = await prisma.courseSuggestion.findUnique({
        where: { id: suggestion.id },
      });

      expect(course?.generationStatus).toBe("failed");
      expect(dbSuggestion?.generationStatus).toBe("failed");
    });

    test("chapter generation errors don't mark course as failed", async () => {
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
        include: {
          chapters: {
            orderBy: { position: "asc" },
          },
        },
        where: { slug },
      });

      expect(course?.generationStatus).toBe("completed");

      const firstChapter = course?.chapters[0];
      expect(firstChapter?.generationStatus).toBe("failed");
    });
  });

  describe("targetLanguage propagation", () => {
    test("creates language course with correct title and targetLanguage", async () => {
      // The data layer resolves "es" to "Spanish" via Intl before persisting the suggestion.
      // The workflow should propagate both the Intl-derived title and targetLanguage to the course.
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "language" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const title = `Spanish ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        language: "en",
        slug,
        targetLanguage: "es",
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        where: { slug },
      });

      expect(course?.title).toBe(title);
      expect(course?.targetLanguage).toBe("es");
    });

    test("creates non-language course with null targetLanguage", async () => {
      const title = `Calculus ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        targetLanguage: null,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        where: { slug },
      });

      expect(course?.title).toBe(title);
      expect(course?.targetLanguage).toBeNull();
    });

    test("language course gets 'languages' category without AI call", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "language" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const title = `Spanish Lang Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        targetLanguage: "es",
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        include: { categories: true },
        where: { slug },
      });

      expect(course?.categories).toHaveLength(1);
      expect(course?.categories[0]?.category).toBe("languages");
      expect(generateCourseCategories).not.toHaveBeenCalled();
    });

    test("non-language course uses AI for categories", async () => {
      const title = `Math Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        targetLanguage: null,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      expect(generateCourseCategories).toHaveBeenCalled();
    });

    test("language course calls generateLanguageCourseChapters", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "language" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const title = `Language Chapters Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        targetLanguage: "es",
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      expect(generateLanguageCourseChapters).toHaveBeenCalled();
      expect(generateCourseChapters).not.toHaveBeenCalled();
    });

    test("non-language course calls generateCourseChapters", async () => {
      const title = `Generic Chapters Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        targetLanguage: null,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      expect(generateCourseChapters).toHaveBeenCalled();
      expect(generateLanguageCourseChapters).not.toHaveBeenCalled();
    });

    test("filters out 'languages' category from AI results for non-language courses", async () => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- testing safety net for unexpected AI output
      vi.mocked(generateCourseCategories).mockResolvedValueOnce({
        data: { categories: ["arts", "languages"] },
      } as never);

      const title = `Literature Course ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        slug,
        targetLanguage: null,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const course = await prisma.course.findFirst({
        include: { categories: true },
        where: { slug },
      });

      const categoryNames = course?.categories.map((cat) => cat.category);
      expect(categoryNames).toContain("arts");
      expect(categoryNames).not.toContain("languages");
    });
  });

  describe("non-English course slug suffix", () => {
    test("creates non-English course with suffixed slug", async () => {
      const title = `Aprendizado de Máquina ${randomUUID()}`;
      const slug = toSlug(title);

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        language: "pt",
        slug,
        title,
      });

      await courseGenerationWorkflow(suggestion.id);

      const expectedSlug = `${slug}-pt`;
      const course = await prisma.course.findFirst({
        where: { slug: expectedSlug },
      });

      expect(course).not.toBeNull();
      expect(course?.slug).toBe(expectedSlug);
      expect(course?.language).toBe("pt");
    });
  });
});
