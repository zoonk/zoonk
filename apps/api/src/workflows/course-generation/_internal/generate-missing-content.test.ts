import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { generateMissingContent } from "./generate-missing-content";
import { type ExistingCourseContent } from "./get-or-create-course";

const {
  generateCourseDescriptionMock,
  generateContentThumbnailImageMock,
  generateAlternativeTitlesMock,
  generateCourseCategoriesMock,
  generateCourseChaptersMock,
  generateLanguageCourseChaptersMock,
} = vi.hoisted(() => ({
  generateAlternativeTitlesMock: vi.fn(),
  generateContentThumbnailImageMock: vi.fn(),
  generateCourseCategoriesMock: vi.fn(),
  generateCourseChaptersMock: vi.fn(),
  generateCourseDescriptionMock: vi.fn(),
  generateLanguageCourseChaptersMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: generateCourseDescriptionMock,
}));

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: generateContentThumbnailImageMock,
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
  courseId: "1",
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

const courseSuggestionDescription = "Course suggestion description";

describe(generateMissingContent, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates all content when nothing exists", async () => {
    generateCourseDescriptionMock.mockResolvedValue({ data: { description: "Generated desc" } });

    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/img.webp",
      error: null,
    });

    generateAlternativeTitlesMock.mockResolvedValue({ data: { alternatives: ["Alt 1"] } });
    generateCourseCategoriesMock.mockResolvedValue({ data: { categories: ["programming"] } });

    generateCourseChaptersMock.mockResolvedValue({
      data: { chapters: [{ description: "Ch1 desc", title: "Ch1" }] },
    });

    const result = await generateMissingContent({
      course,
      description: courseSuggestionDescription,
      existing: emptyExisting,
    });

    expect(result.description).toBe("Generated desc");
    expect(result.imageUrl).toBe("https://example.com/img.webp");
    expect(result.alternativeTitles).toStrictEqual(["Alt 1"]);
    expect(result.categories).toStrictEqual(["programming"]);

    expect(result.chapters).toStrictEqual([{ description: "Ch1 desc", title: "Ch1" }]);

    expect(generateContentThumbnailImageMock).toHaveBeenCalledWith({
      description: courseSuggestionDescription,
      kind: "course",
      title: course.courseTitle,
    });
  });

  it("skips generation for fields that already exist", async () => {
    const existing: ExistingCourseContent = {
      description: "Existing desc",
      hasAlternativeTitles: true,
      hasCategories: true,
      hasChapters: true,
      imageUrl: "https://example.com/existing.webp",
    };

    const result = await generateMissingContent({
      course,
      description: courseSuggestionDescription,
      existing,
    });

    expect(result.description).toBe("Existing desc");
    expect(result.imageUrl).toBe("https://example.com/existing.webp");
    expect(result.alternativeTitles).toStrictEqual([]);
    expect(result.categories).toStrictEqual([]);
    expect(result.chapters).toStrictEqual([]);

    expect(generateCourseDescriptionMock).not.toHaveBeenCalled();
    expect(generateContentThumbnailImageMock).not.toHaveBeenCalled();
    expect(generateAlternativeTitlesMock).not.toHaveBeenCalled();
    expect(generateCourseCategoriesMock).not.toHaveBeenCalled();
    expect(generateCourseChaptersMock).not.toHaveBeenCalled();

    const events = getStreamedEvents();
    const skippedSteps = events.filter((event) => event.status === "completed");

    expect(skippedSteps.length).toBeGreaterThanOrEqual(5);
  });

  it("returns 'languages' category for language courses without AI call", async () => {
    const langCourse: CourseContext = { ...course, targetLanguage: "es" };

    generateCourseDescriptionMock.mockResolvedValue({ data: { description: "Lang desc" } });

    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/lang.webp",
      error: null,
    });

    generateAlternativeTitlesMock.mockResolvedValue({ data: { alternatives: [] } });
    generateLanguageCourseChaptersMock.mockResolvedValue({ data: { chapters: [] } });

    const result = await generateMissingContent({
      course: langCourse,
      description: courseSuggestionDescription,
      existing: emptyExisting,
    });

    expect(result.categories).toStrictEqual(["languages"]);
    expect(generateCourseCategoriesMock).not.toHaveBeenCalled();
  });

  it("filters out 'languages' from non-language course categories", async () => {
    generateCourseDescriptionMock.mockResolvedValue({ data: { description: "desc" } });

    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/non-lang.webp",
      error: null,
    });

    generateAlternativeTitlesMock.mockResolvedValue({ data: { alternatives: [] } });

    generateCourseCategoriesMock.mockResolvedValue({
      data: { categories: ["programming", "languages", "web"] },
    });

    generateCourseChaptersMock.mockResolvedValue({ data: { chapters: [] } });

    const result = await generateMissingContent({
      course,
      description: courseSuggestionDescription,
      existing: emptyExisting,
    });

    expect(result.categories).toStrictEqual(["programming", "web"]);
  });
});
