import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateAlternativeTitlesStep } from "./generate-alternative-titles-step";
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

const { generateAlternativeTitlesMock } = vi.hoisted(() => ({
  generateAlternativeTitlesMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/alternative-titles", () => ({
  generateAlternativeTitles: generateAlternativeTitlesMock,
}));

const course: CourseContext = {
  courseId: 1,
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: 1,
  targetLanguage: null,
};

describe(generateAlternativeTitlesStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the generated alternative titles", async () => {
    generateAlternativeTitlesMock.mockResolvedValue({
      data: { alternatives: ["Alt Title 1", "Alt Title 2"] },
    });

    const result = await generateAlternativeTitlesStep(course);

    expect(result).toEqual(["Alt Title 1", "Alt Title 2"]);

    expect(generateAlternativeTitlesMock).toHaveBeenCalledWith({
      language: "en",
      title: "Test Course",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateAlternativeTitles" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateAlternativeTitles" }),
    );
  });

  test("throws and streams error when AI generation fails", async () => {
    generateAlternativeTitlesMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateAlternativeTitlesStep(course)).rejects.toThrow("AI failure");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateAlternativeTitles" }),
    );
  });
});
