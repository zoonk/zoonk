import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDescriptionStep } from "./generate-description-step";
import { type CourseContext } from "./initialize-course-step";

const { generateCourseDescriptionMock } = vi.hoisted(() => ({
  generateCourseDescriptionMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: generateCourseDescriptionMock,
}));

const course: CourseContext = {
  courseId: "1",
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
};

describe(generateDescriptionStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the generated description", async () => {
    generateCourseDescriptionMock.mockResolvedValue({
      data: { description: "A great course about testing" },
    });

    const result = await generateDescriptionStep(course);

    expect(result).toBe("A great course about testing");

    expect(generateCourseDescriptionMock).toHaveBeenCalledWith({
      language: "en",
      title: "Test Course",
    });

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateDescription" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateDescription" }),
    );
  });

  it("throws without streaming error when AI generation fails", async () => {
    generateCourseDescriptionMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateDescriptionStep(course)).rejects.toThrow("AI failure");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateDescription" }),
    );
  });
});
