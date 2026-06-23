import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateImageStep } from "./generate-image-step";
import { type CourseContext } from "./initialize-course-step";

const { generateContentThumbnailImageMock } = vi.hoisted(() => ({
  generateContentThumbnailImageMock: vi.fn(),
}));

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: generateContentThumbnailImageMock,
}));

const course: CourseContext = {
  courseId: "1",
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
};

const description = "Course request description";

describe(generateImageStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the generated image URL", async () => {
    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/image.webp",
      error: null,
    });

    const result = await generateImageStep({ course, description });

    expect(result).toBe("https://example.com/image.webp");

    expect(generateContentThumbnailImageMock).toHaveBeenCalledWith({
      description,
      kind: "course",
      title: course.courseTitle,
    });

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateImage" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateImage" }),
    );
  });

  it("throws without streaming error when image generation fails", async () => {
    generateContentThumbnailImageMock.mockResolvedValue({
      data: null,
      error: new Error("Image generation failed"),
    });

    await expect(generateImageStep({ course, description })).rejects.toThrow(
      "Image generation failed",
    );

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateImage" }),
    );
  });
});
