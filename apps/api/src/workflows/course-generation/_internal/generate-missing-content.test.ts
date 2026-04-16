import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { generateMissingContent } from "./generate-missing-content";
import { type ExistingCourseContent } from "./get-or-create-course";

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

const {
  generateCourseDescriptionMock,
  generateCourseImageMock,
  generateAlternativeTitlesMock,
  generateCourseCategoriesMock,
  generateCourseChaptersMock,
  generateLanguageCourseChaptersMock,
} = vi.hoisted(() => ({
  generateAlternativeTitlesMock: vi.fn(),
  generateCourseCategoriesMock: vi.fn(),
  generateCourseChaptersMock: vi.fn(),
  generateCourseDescriptionMock: vi.fn(),
  generateCourseImageMock: vi.fn(),
  generateLanguageCourseChaptersMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: generateCourseDescriptionMock,
}));

vi.mock("@zoonk/core/courses/image", () => ({
  generateCourseImage: generateCourseImageMock,
}));

vi.mock("@zoonk/ai/tasks/courses/alternative-titles", () => ({
  generateAlternativeTitles: generateAlternativeTitlesMock,
}));

vi.mock("@zoonk/ai/tasks/courses/categories", () => ({
  generateCourseCategories: generateCourseCategoriesMock,
}));

vi.mock("@zoonk/ai/tasks/courses/chapters", () => ({
  generateCourseChapters: generateCourseChaptersMock,
}));

vi.mock("@zoonk/ai/tasks/courses/language-chapters", () => ({
  generateLanguageCourseChapters: generateLanguageCourseChaptersMock,
}));

const course: CourseContext = {
  courseId: 1,
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
};

const emptyExisting: ExistingCourseContent = {
  description: null,
  hasAlternativeTitles: false,
  hasCategories: false,
  hasChapters: false,
  imageUrl: null,
};

describe(generateMissingContent, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates all content when nothing exists", async () => {
    generateCourseDescriptionMock.mockResolvedValue({
      data: { description: "Generated desc" },
    });
    generateCourseImageMock.mockResolvedValue({
      data: "https://example.com/img.webp",
      error: null,
    });
    generateAlternativeTitlesMock.mockResolvedValue({
      data: { alternatives: ["Alt 1"] },
    });
    generateCourseCategoriesMock.mockResolvedValue({
      data: { categories: ["programming"] },
    });
    generateCourseChaptersMock.mockResolvedValue({
      data: { chapters: [{ description: "Ch1 desc", title: "Ch1" }] },
    });

    const result = await generateMissingContent(course, emptyExisting);

    expect(result.description).toBe("Generated desc");
    expect(result.imageUrl).toBe("https://example.com/img.webp");
    expect(result.alternativeTitles).toEqual(["Alt 1"]);
    expect(result.categories).toEqual(["programming"]);
    expect(result.chapters).toEqual([{ description: "Ch1 desc", title: "Ch1" }]);
  });

  test("skips generation for fields that already exist", async () => {
    const existing: ExistingCourseContent = {
      description: "Existing desc",
      hasAlternativeTitles: true,
      hasCategories: true,
      hasChapters: true,
      imageUrl: "https://example.com/existing.webp",
    };

    const result = await generateMissingContent(course, existing);

    expect(result.description).toBe("Existing desc");
    expect(result.imageUrl).toBe("https://example.com/existing.webp");
    expect(result.alternativeTitles).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.chapters).toEqual([]);

    expect(generateCourseDescriptionMock).not.toHaveBeenCalled();
    expect(generateCourseImageMock).not.toHaveBeenCalled();
    expect(generateAlternativeTitlesMock).not.toHaveBeenCalled();
    expect(generateCourseCategoriesMock).not.toHaveBeenCalled();
    expect(generateCourseChaptersMock).not.toHaveBeenCalled();

    const events = getStreamedEvents(writeMock);
    const skippedSteps = events.filter((event) => event.status === "completed");

    expect(skippedSteps.length).toBeGreaterThanOrEqual(5);
  });

  test("returns 'languages' category for language courses without AI call", async () => {
    const langCourse: CourseContext = { ...course, targetLanguage: "es" };

    generateCourseDescriptionMock.mockResolvedValue({
      data: { description: "Lang desc" },
    });
    generateCourseImageMock.mockResolvedValue({ data: null, error: new Error("skip") });
    generateAlternativeTitlesMock.mockResolvedValue({
      data: { alternatives: [] },
    });
    generateLanguageCourseChaptersMock.mockResolvedValue({
      data: { chapters: [] },
    });

    const result = await generateMissingContent(langCourse, emptyExisting);

    expect(result.categories).toEqual(["languages"]);
    expect(generateCourseCategoriesMock).not.toHaveBeenCalled();
  });

  test("filters out 'languages' from non-language course categories", async () => {
    generateCourseDescriptionMock.mockResolvedValue({
      data: { description: "desc" },
    });
    generateCourseImageMock.mockResolvedValue({ data: null, error: new Error("skip") });
    generateAlternativeTitlesMock.mockResolvedValue({
      data: { alternatives: [] },
    });
    generateCourseCategoriesMock.mockResolvedValue({
      data: { categories: ["programming", "languages", "web"] },
    });
    generateCourseChaptersMock.mockResolvedValue({
      data: { chapters: [] },
    });

    const result = await generateMissingContent(course, emptyExisting);

    expect(result.categories).toEqual(["programming", "web"]);
  });
});
