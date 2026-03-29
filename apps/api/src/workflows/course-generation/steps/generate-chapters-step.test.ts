import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateChaptersStep } from "./generate-chapters-step";
import { type CourseContext } from "./initialize-course-step";

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
  courseId: 1,
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: 1,
  targetLanguage: null,
};

const languageCourse: CourseContext = {
  ...baseCourse,
  targetLanguage: "es",
};

describe(generateChaptersStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls generateCourseChapters for non-language courses", async () => {
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

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateChapters" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateChapters" }),
    );
  });

  test("calls generateLanguageCourseChapters for language courses", async () => {
    const chapters = [{ description: "Greetings", title: "Basic Greetings" }];

    generateLanguageCourseChaptersMock.mockResolvedValue({ data: { chapters } });

    const result = await generateChaptersStep(languageCourse);

    expect(result).toEqual(chapters);

    expect(generateLanguageCourseChaptersMock).toHaveBeenCalledWith({
      targetLanguage: "es",
      userLanguage: "en",
    });
  });

  test("throws and streams error when AI generation fails", async () => {
    generateCourseChaptersMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateChaptersStep(baseCourse)).rejects.toThrow("AI failure");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateChapters" }),
    );
  });
});
