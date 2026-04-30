import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAlternativeTitlesStep } from "./generate-alternative-titles-step";
import { type CourseContext } from "./initialize-course-step";

const { generateAlternativeTitlesMock } = vi.hoisted(() => ({
  generateAlternativeTitlesMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/alternative-titles", () => ({
  generateAlternativeTitles: generateAlternativeTitlesMock,
}));

const course: CourseContext = {
  courseId: "1",
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
};

describe(generateAlternativeTitlesStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the generated alternative titles", async () => {
    generateAlternativeTitlesMock.mockResolvedValue({
      data: { alternatives: ["Alt Title 1", "Alt Title 2"] },
    });

    const result = await generateAlternativeTitlesStep(course);

    expect(result).toStrictEqual(["Alt Title 1", "Alt Title 2"]);

    expect(generateAlternativeTitlesMock).toHaveBeenCalledWith({
      language: "en",
      title: "Test Course",
    });

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateAlternativeTitles" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateAlternativeTitles" }),
    );
  });

  it("throws without streaming error when AI generation fails", async () => {
    generateAlternativeTitlesMock.mockRejectedValue(new Error("AI failure"));

    await expect(generateAlternativeTitlesStep(course)).rejects.toThrow("AI failure");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateAlternativeTitles" }),
    );
  });
});
