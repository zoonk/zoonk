import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateIntroductionChapterStep } from "./generate-introduction-chapter-step";
import { type CourseContext } from "./initialize-course-step";

const { generateCourseIntroductionMock } = vi.hoisted(() => ({
  generateCourseIntroductionMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/introduction", () => ({
  generateCourseIntroduction: generateCourseIntroductionMock,
}));

const course = {
  courseId: "course-1",
  courseSlug: "test-course",
  courseTitle: "Test Course",
  format: "core",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
} satisfies Extract<CourseContext, { format: "core" }>;

describe(generateIntroductionChapterStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the generated introduction chapter plan", async () => {
    const introduction = {
      chapter: { description: "A quick field guide.", title: "Start here" },
      lessons: [
        { description: "See what the field does.", title: "What this field can do" },
        { description: "Find useful real-world paths.", title: "Where people use it" },
        { description: "Preview the full course.", title: "How the course goes deeper" },
      ],
    };

    generateCourseIntroductionMock.mockResolvedValue({ data: introduction });

    const result = await generateIntroductionChapterStep(course);

    expect(result).toStrictEqual(introduction);

    expect(generateCourseIntroductionMock).toHaveBeenCalledWith({
      courseTitle: "Test Course",
      language: "en",
    });

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateIntroductionChapter" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateIntroductionChapter" }),
    );
  });

  it("throws without streaming error when AI generation fails", async () => {
    generateCourseIntroductionMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateIntroductionChapterStep(course)).rejects.toThrow("AI failure");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateIntroductionChapter" }),
    );
  });
});
