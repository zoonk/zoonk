import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLandingPageStep } from "./generate-landing-page-step";
import { type CourseContext } from "./initialize-course-step";

const { generateCourseLandingPageMock } = vi.hoisted(() => ({
  generateCourseLandingPageMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/landing-page", () => ({
  generateCourseLandingPage: generateCourseLandingPageMock,
}));

const course: CourseContext = {
  courseId: "1",
  courseSlug: "test-course",
  courseTitle: "Test Course",
  language: "en",
  organizationId: "org-1",
  targetLanguage: null,
};

describe(generateLandingPageStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the generated landing page copy", async () => {
    const landingPage = {
      audience: ["New learners"],
      opportunities: ["Use this in real projects"],
      outcomes: ["Build practical skill"],
      valueProposition: "A clear path into the subject.",
    };

    const chapters = [{ description: "Chapter description", title: "Chapter title" }];

    generateCourseLandingPageMock.mockResolvedValue({ data: landingPage });

    const result = await generateLandingPageStep({
      chapters,
      course,
      description: "A concise course description.",
    });

    expect(result).toStrictEqual(landingPage);

    expect(generateCourseLandingPageMock).toHaveBeenCalledWith({
      chapters,
      description: "A concise course description.",
      language: "en",
      targetLanguage: null,
      title: "Test Course",
    });

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateLandingPage" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateLandingPage" }),
    );
  });

  it("throws without streaming error when AI generation fails", async () => {
    generateCourseLandingPageMock.mockRejectedValue(new Error("AI failure"));

    await expect(
      generateLandingPageStep({ chapters: [], course, description: "" }),
    ).rejects.toThrow("AI failure");

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateLandingPage" }),
    );
  });
});
