import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateCategoriesStep } from "./generate-categories-step";
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

const { generateCourseCategoriesMock } = vi.hoisted(() => ({
  generateCourseCategoriesMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/categories", () => ({
  generateCourseCategories: generateCourseCategoriesMock,
}));

const course: CourseContext = {
  courseId: "1",
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
};

describe(generateCategoriesStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the generated categories", async () => {
    generateCourseCategoriesMock.mockResolvedValue({
      data: { categories: ["programming", "web"] },
    });

    const result = await generateCategoriesStep(course);

    expect(result).toEqual(["programming", "web"]);

    expect(generateCourseCategoriesMock).toHaveBeenCalledWith({
      courseTitle: "Test Course",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateCategories" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateCategories" }),
    );
  });

  test("throws and streams error when AI generation fails", async () => {
    generateCourseCategoriesMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateCategoriesStep(course)).rejects.toThrow("AI failure");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateCategories" }),
    );
  });
});
