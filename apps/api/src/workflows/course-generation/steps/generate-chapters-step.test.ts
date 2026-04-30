import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateChaptersStep } from "./generate-chapters-step";
import { type CourseContext } from "./initialize-course-step";

const { generateCourseChaptersMock, generateLanguageCourseChaptersMock } = vi.hoisted(() => ({
  generateCourseChaptersMock: vi.fn(),
  generateLanguageCourseChaptersMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/chapters", () => ({
  generateCourseChapters: generateCourseChaptersMock,
}));

vi.mock("@zoonk/ai/tasks/courses/language-chapters", () => ({
  generateLanguageCourseChapters: generateLanguageCourseChaptersMock,
}));

const baseCourse: CourseContext = {
  courseId: "1",
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
};

const languageCourse: CourseContext = { ...baseCourse, targetLanguage: "es" };

describe(generateChaptersStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateCourseChapters for non-language courses", async () => {
    const chapters = [
      { description: "Intro chapter", title: "Introduction" },
      { description: "Basics chapter", title: "Basics" },
    ];

    generateCourseChaptersMock.mockResolvedValue({ data: { chapters } });

    const result = await generateChaptersStep(baseCourse);

    expect(result).toEqual(chapters);

    expect(generateCourseChaptersMock).toHaveBeenCalledWith({
      courseTitle: "Test Course",
      language: "en",
    });

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateChapters" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateChapters" }),
    );
  });

  it("calls generateLanguageCourseChapters for language courses", async () => {
    const chapters = [{ description: "Greetings", title: "Basic Greetings" }];

    generateLanguageCourseChaptersMock.mockResolvedValue({ data: { chapters } });

    const result = await generateChaptersStep(languageCourse);

    expect(result).toEqual(chapters);

    expect(generateLanguageCourseChaptersMock).toHaveBeenCalledWith({
      targetLanguage: "es",
      userLanguage: "en",
    });
  });

  it("throws without streaming error when AI generation fails", async () => {
    generateCourseChaptersMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateChaptersStep(baseCourse)).rejects.toThrow("AI failure");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateChapters" }),
    );
  });
});
