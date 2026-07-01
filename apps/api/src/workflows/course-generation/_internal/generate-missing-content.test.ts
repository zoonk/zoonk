import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./existing-course-content";
import { generateMissingContent } from "./generate-missing-content";

const {
  generateCourseDescriptionMock,
  generateCourseLandingPageMock,
  generateContentThumbnailImageMock,
  generateCourseCategoriesMock,
  generateCourseChaptersMock,
  generateLanguageCourseChaptersMock,
} = vi.hoisted(() => ({
  generateContentThumbnailImageMock: vi.fn(),
  generateCourseCategoriesMock: vi.fn(),
  generateCourseChaptersMock: vi.fn(),
  generateCourseDescriptionMock: vi.fn(),
  generateCourseLandingPageMock: vi.fn(),
  generateLanguageCourseChaptersMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: generateCourseDescriptionMock,
}));

vi.mock("@zoonk/ai/tasks/courses/landing-page", () => ({
  generateCourseLandingPage: generateCourseLandingPageMock,
}));

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: generateContentThumbnailImageMock,
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
  hasCategories: false,
  hasChapters: false,
  imageUrl: null,
  landingPage: null,
};

const courseRequestDescription = "Course request description";

describe(generateMissingContent, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates all content when nothing exists", async () => {
    generateCourseDescriptionMock.mockResolvedValue({ data: { description: "Generated desc" } });

    generateCourseLandingPageMock.mockResolvedValue({
      data: {
        audience: ["New learners"],
        opportunities: ["Use this in real projects"],
        outcomes: ["Build practical skill"],
        valueProposition: "A clear path into the subject.",
      },
    });

    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/img.webp",
      error: null,
    });

    generateCourseCategoriesMock.mockResolvedValue({ data: { categories: ["programming"] } });

    generateCourseChaptersMock.mockResolvedValue({
      data: { chapters: [{ description: "Ch1 desc", title: "Ch1" }] },
    });

    const result = await generateMissingContent({
      course,
      description: courseRequestDescription,
      existing: emptyExisting,
    });

    expect(result.description).toBe("Generated desc");

    expect(result.landingPage).toStrictEqual({
      audience: ["New learners"],
      opportunities: ["Use this in real projects"],
      outcomes: ["Build practical skill"],
      valueProposition: "A clear path into the subject.",
    });

    expect(result.imageUrl).toBe("https://example.com/img.webp");
    expect(result.categories).toStrictEqual(["programming"]);

    expect(result.chapters).toStrictEqual([{ description: "Ch1 desc", title: "Ch1" }]);

    expect(generateCourseLandingPageMock).toHaveBeenCalledWith({
      chapters: [{ description: "Ch1 desc", title: "Ch1" }],
      description: "Generated desc",
      language: "en",
      targetLanguage: null,
      title: "Test Course",
    });

    expect(generateContentThumbnailImageMock).toHaveBeenCalledWith({
      description: courseRequestDescription,
      kind: "course",
      title: course.courseTitle,
    });
  });

  it("skips generation for fields that already exist", async () => {
    const existing: ExistingCourseContent = {
      description: "Existing desc",
      hasCategories: true,
      hasChapters: true,
      imageUrl: "https://example.com/existing.webp",
      landingPage: {
        audience: ["Existing audience"],
        opportunities: ["Existing opportunity"],
        outcomes: ["Existing outcome"],
        valueProposition: "Existing value.",
      },
    };

    const result = await generateMissingContent({
      course,
      description: courseRequestDescription,
      existing,
    });

    expect(result.description).toBe("Existing desc");

    expect(result.landingPage).toStrictEqual({
      audience: ["Existing audience"],
      opportunities: ["Existing opportunity"],
      outcomes: ["Existing outcome"],
      valueProposition: "Existing value.",
    });

    expect(result.imageUrl).toBe("https://example.com/existing.webp");
    expect(result.categories).toStrictEqual([]);
    expect(result.chapters).toStrictEqual([]);

    expect(generateCourseDescriptionMock).not.toHaveBeenCalled();
    expect(generateCourseLandingPageMock).not.toHaveBeenCalled();
    expect(generateContentThumbnailImageMock).not.toHaveBeenCalled();
    expect(generateCourseCategoriesMock).not.toHaveBeenCalled();
    expect(generateCourseChaptersMock).not.toHaveBeenCalled();

    const events = getStreamedEvents();
    const skippedSteps = events.filter((event) => event.status === "completed");

    expect(skippedSteps.length).toBeGreaterThanOrEqual(4);
  });

  it("skips categories and landing page AI calls for language courses", async () => {
    const langCourse: CourseContext = { ...course, targetLanguage: "es" };

    generateCourseDescriptionMock.mockResolvedValue({ data: { description: "Lang desc" } });

    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/lang.webp",
      error: null,
    });

    generateLanguageCourseChaptersMock.mockResolvedValue({ data: { chapters: [] } });

    const result = await generateMissingContent({
      course: langCourse,
      description: courseRequestDescription,
      existing: emptyExisting,
    });

    expect(result.categories).toStrictEqual(["languages"]);
    expect(result.landingPage).toBeNull();
    expect(generateCourseCategoriesMock).not.toHaveBeenCalled();
    expect(generateCourseLandingPageMock).not.toHaveBeenCalled();
  });

  it("filters out 'languages' from non-language course categories", async () => {
    generateCourseDescriptionMock.mockResolvedValue({ data: { description: "desc" } });

    generateCourseLandingPageMock.mockResolvedValue({
      data: {
        audience: ["Curious learners"],
        opportunities: ["Apply ideas clearly"],
        outcomes: ["Explain key ideas"],
        valueProposition: "A useful path through the topic.",
      },
    });

    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/non-lang.webp",
      error: null,
    });

    generateCourseCategoriesMock.mockResolvedValue({
      data: { categories: ["programming", "languages", "web"] },
    });

    generateCourseChaptersMock.mockResolvedValue({ data: { chapters: [] } });

    const result = await generateMissingContent({
      course,
      description: courseRequestDescription,
      existing: emptyExisting,
    });

    expect(result.categories).toStrictEqual(["programming", "web"]);
  });
});
