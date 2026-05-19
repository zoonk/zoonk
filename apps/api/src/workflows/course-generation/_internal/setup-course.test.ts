import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./get-or-create-course";
import { setupCourse } from "./setup-course";

const {
  generateCourseDescriptionMock,
  generateContentThumbnailImageMock,
  generateCourseCategoriesMock,
  generateCourseChaptersMock,
} = vi.hoisted(() => ({
  generateContentThumbnailImageMock: vi.fn(),
  generateCourseCategoriesMock: vi.fn(),
  generateCourseChaptersMock: vi.fn(),
  generateCourseDescriptionMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: generateCourseDescriptionMock,
}));

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: generateContentThumbnailImageMock,
}));

vi.mock("@zoonk/ai/tasks/courses/categories", () => ({
  generateCourseCategories: generateCourseCategoriesMock,
}));

vi.mock("@zoonk/ai/tasks/courses/chapters", () => ({
  generateCourseChapters: generateCourseChaptersMock,
}));

describe(setupCourse, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates and persists course content without completing setup", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Setup Course ${randomUUID()}`,
    });

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
      hasCategories: false,
      hasChapters: false,
      imageUrl: null,
    };

    generateCourseDescriptionMock.mockResolvedValue({ data: { description: "Setup desc" } });

    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/setup.webp",
      error: null,
    });

    generateCourseCategoriesMock.mockResolvedValue({ data: { categories: ["testing"] } });

    generateCourseChaptersMock.mockResolvedValue({
      data: { chapters: [{ description: "Ch desc", title: `Setup Ch ${randomUUID()}` }] },
    });

    const chapters = await setupCourse(courseContext, "Course suggestion description", existing);

    expect(chapters).toHaveLength(1);

    const updatedCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedCourse.description).toBe("Setup desc");
  });
});
