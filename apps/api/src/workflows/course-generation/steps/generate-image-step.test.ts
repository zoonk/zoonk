import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateImageStep } from "./generate-image-step";
import { type CourseContext } from "./initialize-course-step";

const { generateCourseImageMock } = vi.hoisted(() => ({ generateCourseImageMock: vi.fn() }));

vi.mock("@zoonk/core/courses/image", () => ({ generateCourseImage: generateCourseImageMock }));

const course: CourseContext = {
  courseId: "1",
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
};

describe(generateImageStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the generated image URL", async () => {
    generateCourseImageMock.mockResolvedValue({
      data: "https://example.com/image.webp",
      error: null,
    });

    const result = await generateImageStep(course);

    expect(result).toBe("https://example.com/image.webp");

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateImage" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateImage" }),
    );
  });

  it("throws without streaming error when image generation fails", async () => {
    generateCourseImageMock.mockResolvedValue({
      data: null,
      error: new Error("Image generation failed"),
    });

    await expect(generateImageStep(course)).rejects.toThrow("Image generation failed");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateImage" }),
    );
  });
});
