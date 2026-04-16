import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateImageStep } from "./generate-image-step";
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

const { generateCourseImageMock } = vi.hoisted(() => ({
  generateCourseImageMock: vi.fn(),
}));

vi.mock("@zoonk/core/courses/image", () => ({
  generateCourseImage: generateCourseImageMock,
}));

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

  test("returns the generated image URL", async () => {
    generateCourseImageMock.mockResolvedValue({
      data: "https://example.com/image.webp",
      error: null,
    });

    const result = await generateImageStep(course);

    expect(result).toBe("https://example.com/image.webp");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateImage" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateImage" }),
    );
  });

  test("returns null when image generation fails (non-critical)", async () => {
    generateCourseImageMock.mockResolvedValue({
      data: null,
      error: new Error("Image generation failed"),
    });

    const result = await generateImageStep(course);

    expect(result).toBeNull();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateImage" }),
    );
  });
});
