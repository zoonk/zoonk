import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./get-or-create-course";
import { setupCourse } from "./setup-course";

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

const {
  generateCourseDescriptionMock,
  generateCourseImageMock,
  generateAlternativeTitlesMock,
  generateCourseCategoriesMock,
  generateCourseChaptersMock,
} = vi.hoisted(() => ({
  generateAlternativeTitlesMock: vi.fn(),
  generateCourseCategoriesMock: vi.fn(),
  generateCourseChaptersMock: vi.fn(),
  generateCourseDescriptionMock: vi.fn(),
  generateCourseImageMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: generateCourseDescriptionMock,
}));

vi.mock("@zoonk/core/courses/image", () => ({
  generateCourseImage: generateCourseImageMock,
}));

vi.mock("@zoonk/ai/tasks/courses/alternative-titles", () => ({
  generateAlternativeTitles: generateAlternativeTitlesMock,
}));

vi.mock("@zoonk/ai/tasks/courses/categories", () => ({
  generateCourseCategories: generateCourseCategoriesMock,
}));

vi.mock("@zoonk/ai/tasks/courses/chapters", () => ({
  generateCourseChapters: generateCourseChaptersMock,
}));

describe(setupCourse, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates content, persists it, and marks course as completed", async () => {
    const [course, suggestion] = await Promise.all([
      courseFixture({
        generationStatus: "running",
        organizationId,
        title: `Setup Course ${randomUUID()}`,
      }),
      courseSuggestionFixture({
        generationStatus: "running",
        title: `Setup Suggestion ${randomUUID()}`,
      }),
    ]);

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    const existing: ExistingCourseContent = {
      description: null,
      hasAlternativeTitles: false,
      hasCategories: false,
      hasChapters: false,
      imageUrl: null,
    };

    generateCourseDescriptionMock.mockResolvedValue({
      data: { description: "Setup desc" },
    });
    generateCourseImageMock.mockResolvedValue({
      data: "https://example.com/setup.webp",
      error: null,
    });
    generateAlternativeTitlesMock.mockResolvedValue({
      data: { alternatives: [`Alt ${randomUUID()}`] },
    });
    generateCourseCategoriesMock.mockResolvedValue({
      data: { categories: ["testing"] },
    });
    generateCourseChaptersMock.mockResolvedValue({
      data: {
        chapters: [{ description: "Ch desc", title: `Setup Ch ${randomUUID()}` }],
      },
    });

    const chapters = await setupCourse(courseContext, suggestion.id, existing);

    expect(chapters).toHaveLength(1);

    const [updatedCourse, updatedSuggestion] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("completed");
    expect(updatedCourse.description).toBe("Setup desc");
    expect(updatedSuggestion.generationStatus).toBe("completed");
  });
});
