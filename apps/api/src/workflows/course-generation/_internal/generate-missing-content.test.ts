import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./existing-course-content";
import { generateMissingContent } from "./generate-missing-content";

const {
  generateCourseDescriptionMock,
  generateCourseIntroductionMock,
  generateCourseLandingPageMock,
  generateContentThumbnailImageMock,
  generateIntroductionLessonContentMock,
  getCourseIntroductionLessonsStepMock,
  persistIntroductionChapterMock,
  generateCourseCategoriesMock,
  generateCourseChaptersMock,
  generateLanguageCourseChaptersMock,
} = vi.hoisted(() => ({
  generateContentThumbnailImageMock: vi.fn(),
  generateCourseCategoriesMock: vi.fn(),
  generateCourseChaptersMock: vi.fn(),
  generateCourseDescriptionMock: vi.fn(),
  generateCourseIntroductionMock: vi.fn(),
  generateCourseLandingPageMock: vi.fn(),
  generateIntroductionLessonContentMock: vi.fn(),
  generateLanguageCourseChaptersMock: vi.fn(),
  getCourseIntroductionLessonsStepMock: vi.fn(),
  persistIntroductionChapterMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: generateCourseDescriptionMock,
}));

vi.mock("@zoonk/ai/tasks/courses/landing-page", () => ({
  generateCourseLandingPage: generateCourseLandingPageMock,
}));

vi.mock("@zoonk/ai/tasks/courses/introduction", () => ({
  generateCourseIntroduction: generateCourseIntroductionMock,
}));

vi.mock("./introduction-course-setup", () => ({
  generateIntroductionLessonContent: generateIntroductionLessonContentMock,
  persistIntroductionChapter: persistIntroductionChapterMock,
}));

vi.mock("../steps/get-introduction-lessons-step", () => ({
  getCourseIntroductionLessonsStep: getCourseIntroductionLessonsStepMock,
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
  chapterCount: 0,
  description: null,
  hasCategories: false,
  hasIntroductionLessons: false,
  hasMainCurriculum: false,
  imageUrl: null,
  landingPage: null,
};

const courseRequestDescription = "Course request description";

/**
 * Creates a manually-resolved promise so concurrency tests can hold one AI
 * branch open while checking whether the other independent branches started.
 */
function createDeferred<Value>() {
  return Promise.withResolvers<Value>();
}

describe(generateMissingContent, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    generateCourseIntroductionMock.mockResolvedValue({
      data: {
        chapter: { description: "Intro chapter desc", title: "Intro chapter" },
        lessons: [{ description: "Intro lesson desc", title: "Intro lesson" }],
      },
    });

    persistIntroductionChapterMock.mockResolvedValue({
      chapter: { id: "intro-chapter", position: 0 },
      lessons: [{ id: "intro-lesson", kind: "explanation" }],
    });

    getCourseIntroductionLessonsStepMock.mockResolvedValue([
      { id: "existing-intro-lesson", kind: "explanation" },
    ]);
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

    expect(generateIntroductionLessonContentMock).toHaveBeenCalledWith([
      { id: "intro-lesson", kind: "explanation" },
    ]);

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

  it("starts sibling course setup generation without waiting for the introduction", async () => {
    const introductionResult = {
      data: {
        chapter: { description: "Intro chapter desc", title: "Intro chapter" },
        lessons: [{ description: "Intro lesson desc", title: "Intro lesson" }],
      },
    };

    const introduction = createDeferred<typeof introductionResult>();

    generateCourseIntroductionMock.mockReturnValueOnce(introduction.promise);

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

    const resultPromise = generateMissingContent({
      course,
      description: courseRequestDescription,
      existing: emptyExisting,
    });

    await vi.waitFor(() => {
      expect(generateCourseDescriptionMock).toHaveBeenCalledWith({
        language: course.language,
        title: course.courseTitle,
      });

      expect(generateContentThumbnailImageMock).toHaveBeenCalledWith({
        description: courseRequestDescription,
        kind: "course",
        title: course.courseTitle,
      });

      expect(generateCourseCategoriesMock).toHaveBeenCalledWith({
        courseTitle: course.courseTitle,
      });

      expect(generateCourseChaptersMock).toHaveBeenCalledWith({
        courseTitle: course.courseTitle,
        language: course.language,
      });
    });

    introduction.resolve(introductionResult);

    await expect(resultPromise).resolves.toMatchObject({ description: "Generated desc" });
  });

  it("skips generation for fields that already exist", async () => {
    const existing: ExistingCourseContent = {
      chapterCount: 2,
      description: "Existing desc",
      hasCategories: true,
      hasIntroductionLessons: true,
      hasMainCurriculum: true,
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
    expect(generateCourseIntroductionMock).not.toHaveBeenCalled();

    expect(generateIntroductionLessonContentMock).toHaveBeenCalledWith([
      { id: "existing-intro-lesson", kind: "explanation" },
    ]);

    const events = getStreamedEvents();
    const skippedSteps = events.filter((event) => event.status === "completed");

    expect(skippedSteps.length).toBeGreaterThanOrEqual(4);
  });

  it("generates curriculum when only the intro chapter exists", async () => {
    const existing: ExistingCourseContent = {
      chapterCount: 1,
      description: "Existing desc",
      hasCategories: true,
      hasIntroductionLessons: true,
      hasMainCurriculum: false,
      imageUrl: "https://example.com/existing.webp",
      landingPage: {
        audience: ["Existing audience"],
        opportunities: ["Existing opportunity"],
        outcomes: ["Existing outcome"],
        valueProposition: "Existing value.",
      },
    };

    generateCourseChaptersMock.mockResolvedValue({
      data: { chapters: [{ description: "Main desc", title: "Main curriculum" }] },
    });

    const result = await generateMissingContent({
      course,
      description: courseRequestDescription,
      existing,
    });

    expect(result.chapters).toStrictEqual([{ description: "Main desc", title: "Main curriculum" }]);

    expect(generateCourseDescriptionMock).not.toHaveBeenCalled();
    expect(generateCourseLandingPageMock).not.toHaveBeenCalled();
    expect(generateContentThumbnailImageMock).not.toHaveBeenCalled();
    expect(generateCourseCategoriesMock).not.toHaveBeenCalled();
    expect(generateCourseIntroductionMock).not.toHaveBeenCalled();

    expect(generateCourseChaptersMock).toHaveBeenCalledWith({
      courseTitle: "Test Course",
      language: "en",
    });

    expect(generateIntroductionLessonContentMock).toHaveBeenCalledWith([
      { id: "existing-intro-lesson", kind: "explanation" },
    ]);
  });

  it("generates missing introduction without regenerating saved main curriculum", async () => {
    const existing: ExistingCourseContent = {
      chapterCount: 2,
      description: "Existing desc",
      hasCategories: true,
      hasIntroductionLessons: false,
      hasMainCurriculum: true,
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

    expect(result.chapters).toStrictEqual([]);

    expect(generateCourseChaptersMock).not.toHaveBeenCalled();

    expect(generateIntroductionLessonContentMock).toHaveBeenCalledWith([
      { id: "intro-lesson", kind: "explanation" },
    ]);

    expect(generateCourseIntroductionMock).toHaveBeenCalledWith({
      courseTitle: "Test Course",
      language: "en",
    });
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
    expect(generateCourseIntroductionMock).not.toHaveBeenCalled();
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
